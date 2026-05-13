from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
import mysql.connector
from fastapi.responses import JSONResponse
import json
from cachetools import TTLCache
from datetime import datetime
import time
from typing import List, Tuple, Optional, Dict, Any

# Cache that holds 1 item, expires in 300 seconds (5 mins)
bms_cache = TTLCache(maxsize=1, ttl=300)

app = FastAPI()

origins = [
    "*",
    # Add more origins as needed
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

file_path = "/home/tenet/ems/Creds/db_creds.json"

with open(file_path, 'r') as file:
    data = json.load(file)

def get_emsdb():
    db = mysql.connector.connect(
        host=data['awsDB']['host'],
        user=data['awsDB']['user'],
        password=data['awsDB']['password'],
        database='EMS',
        port=data['awsDB']['port']
    )
    return db

def get_bmsdb():
    db=mysql.connector.connect(
        host=data['bmsDB1']['host'],
        user=data['bmsDB1']['user'],
        password=data['bmsDB1']['password'],
        port=data['bmsDB1']['port']
    )
    return db


def custom_round(number):
    last_two_digits = number % 100
    if last_two_digits < 50:
        return (number // 100) * 100
    else:
        return ((number // 100) + 1) * 100

windSpeed = {
    None : None,
    0   :0,
    3   :4.8,
    3.5 :49.8,
    4   :132,
    4.5 :230.4,
    5   :340.8,
    5.5 :469.5,
    6   :621,
    6.5 :799.2,
    7   :1003.8,
    7.5 :1236,
    8   :1489.8,
    8.5 :1734,
    9   :1905,
    9.5 :1967.4,
    10  :1971.6,
    10.5:1975.8,
    11  :1980,
    11.5:1980,
    12  :1980,
    12.5:1980,
    13  :1980,
    13.5:1980,
    14  :1980,
    14.5:1980,
    15  :1980,  
    15.5:1980,
    16  :1980,
    16.5:1980,
    17  :1980,
    17.5:1980,
    18  :1980,
    18.5:1980,
    19  :1980,
    19.5:1980,
    20  :1980
}

def custom_round(number):
    last_two_digits = number % 100
    if last_two_digits < 50:
        return (number // 100) * 100
    else:
        return ((number // 100) + 1) * 100

# --- FIX: Corrected logic in getNacelleDir from 'or' to 'and' ---
def getNacelleDir(angle: Optional[float]) -> str:
    if angle is None:
        return "N/A"
    if angle >= 337.5 or angle < 22.5:
        return "N"
    elif angle >= 22.5 and angle < 67.5:
        return "NE"
    elif angle >= 67.5 and angle < 112.5:
        return "E"
    elif angle >= 112.5 and angle < 157.5:
        return "SE"
    elif angle >= 157.5 and angle < 202.5:
        return "S"
    elif angle >= 202.5 and angle < 247.5:
        return "SW"
    elif angle >= 247.5 and angle < 292.5:
        return "W"
    else: # angle >= 292.5 and angle < 337.5
        return "NW"

def wind_round(x: Optional[float]) -> Optional[float]:
    if x is not None:
        integer_part = int(x)
        decimal_part = x - integer_part
        if decimal_part < 0.5:
            return integer_part
        elif decimal_part == 0.5:
            return integer_part + 0.5
        else:
            return integer_part + 1
    return None  


# --- REFACTOR: Create a shared data processing function ---
def _process_wind_data(all_day_data: List[Tuple], avg_data: Optional[Tuple]) -> Dict[str, Any]:
    """
    Processes raw database query results into the final JSON structure.
    This eliminates code duplication between endpoints.
    """
    windJson = {
        'windScatterplot': [],
        'windParameters': [],
        'windExpected': [],
        'windPower': []
    }
    
    latest_row: Optional[Tuple] = None
    
    # Process row-by-row data in a single loop
    for row in all_day_data:
        active_power, wind_speed, polled_time, nacelle_dir, ambient_temp, gen_speed, rotor_speed = row
        
        windJson['windScatterplot'].append({'power': active_power, 'windspeed': wind_speed})
        
        power_value = (active_power * 60) if active_power is not None and active_power >= 0 else 0
        windJson['windPower'].append({
            "polledTime": polled_time,
            "activePower": power_value,
            "windSpeed": wind_speed
        })
        
        latest_row = row

    # Process the latest row for windParameters
    if latest_row:
        _, wind_speed, _, nacelle_dir, ambient_temp, gen_speed, rotor_speed = latest_row
        windJson['windParameters'].append({
            "windSpeed": wind_speed,
            "temperature": ambient_temp,
            "rotorSpeed": rotor_speed,
            "genSpeed": gen_speed,
            "nacelleDirection": getNacelleDir(nacelle_dir)
        })

    # Process the aggregated data for windExpected
    if avg_data and avg_data[0] is not None and avg_data[1] is not None:
        avg_power, avg_speed = avg_data
        speed = wind_round(avg_speed)
        # Use .get() for safety to avoid KeyError if speed is not in the dictionary
        expected_power = windSpeed.get(speed, 0)
        windJson['windExpected'].append({
            "expectedSpeed": 20, # Preserving original logic
            "windSpeed": avg_speed,
            "averagePower": avg_power,
            "expexctedPower": expected_power
        })
        
    return windJson

# --- API Endpoints ---

@app.get('/wind/currentData')
def get_current_wind_data(db: mysql.connector.connect = Depends(get_bmsdb)):
    """
    Fetches wind data for the current day.
    Uses an in-memory cache to avoid hitting the database on every request.
    """
    if 'wind_data' in bms_cache:
        print("Returning cached data")
        return bms_cache['wind_data']
    
    print("Getting data from DB")

    try:
        # Use the injected connection 'db' directly
        with db.cursor() as cursor:
            # Query 1: Fetch all required row-by-row data for today
            # This is optimized to fetch everything needed for scatter/power/params in one go.
            query1 = """
                SELECT 
                    otpmgndetailsactivepower,
                    otpmgndetailswindspeed,
                    DATE_FORMAT(FROM_UNIXTIME(otpmgndetailspolledtimestamp), '%H:%i') as polled_time,
                    otpmgndetailsnacelledirection,
                    otpmgndetailsambienttemp,
                    ROUND(otpmgndetailsgenspeed, 1),
                    ROUND(otpmgndetailsrotorspeed, 1)
                FROM bmsmgmtprodv13.otpmgndetails 
                WHERE otpmgndetailspolledtimestamp >= UNIX_TIMESTAMP(CURDATE())
                  AND otpmgndetailspolledtimestamp < UNIX_TIMESTAMP(CURDATE() + INTERVAL 1 DAY)
                  AND otpmgndetailswindspeed > 0
                ORDER BY otpmgndetailspolledtimestamp ASC;
            """
            cursor.execute(query1)
            all_day_data = cursor.fetchall()

            # Query 2: Fetch the aggregated average data for today
            query2 = """
                SELECT 
                    ROUND(AVG(otpmgndetailsactivepower)) as power, 
                    ROUND(AVG(otpmgndetailswindspeed)) as speed
                FROM bmsmgmtprodv13.otpmgndetails 
                WHERE otpmgndetailspolledtimestamp >= UNIX_TIMESTAMP(CURDATE())
                  AND otpmgndetailspolledtimestamp < UNIX_TIMESTAMP(CURDATE() + INTERVAL 1 DAY)
                  AND otpmgndetailsactivepower > 0;
            """
            cursor.execute(query2)
            avg_data = cursor.fetchone()

    except mysql.connector.Error as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL error: {str(e)}"})
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"An unexpected error occurred: {str(e)}"})

    # Process the data using the shared helper function
    windJson = _process_wind_data(all_day_data, avg_data)
    
    # Cache the result
    bms_cache['wind_data'] = windJson

    return windJson


@app.post('/wind/Filtered')
def get_filtered_wind_data(payload: dict, db: mysql.connector.connect = Depends(get_bmsdb)):
    """
    Fetches wind data for a specific date provided in the request payload.
    This endpoint is NOT cached.
    """
    date_str = payload.get('date')
    if not date_str:
        raise HTTPException(status_code=400, detail="Date is required in the payload.")
    
    try:
        # Validate date format
        datetime.strptime(date_str, '%Y-%m-%d')
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    try:
        with db.cursor() as cursor:
            # --- SECURITY FIX: Use parameterized queries to prevent SQL injection ---
            
            # Query 1: Fetch all row-by-row data for the specified date
            # Note: Removed f-string prefix and replaced with %s placeholders
            query1 = """
                SELECT
                    otpmgndetailsactivepower,
                    otpmgndetailswindspeed,
                    DATE_FORMAT(FROM_UNIXTIME(otpmgndetailspolledtimestamp), '%H:%i') as polled_time,
                    otpmgndetailsnacelledirection,
                    otpmgndetailsambienttemp,
                    ROUND(otpmgndetailsgenspeed, 1),
                    ROUND(otpmgndetailsrotorspeed, 1)
                from bmsmgmtprodv13.otpmgndetails
                where FROM_UNIXTIME(otpmgndetailspolledtimestamp) >= %s
                and FROM_UNIXTIME(otpmgndetailspolledtimestamp) < %s + interval 1 day
                AND otpmgndetailswindspeed > 0
                ORDER BY otpmgndetailspolledtimestamp ASC;
            """
            # Pass parameters safely in a tuple
            cursor.execute(query1, (date_str, date_str))
            all_day_data = cursor.fetchall()

            # Query 2: Fetch aggregated data for the specified date
            # Note: Removed f-string prefix and replaced with %s placeholders
            query2 = """
                SELECT 
                    ROUND(AVG(otpmgndetailsactivepower)) as power, 
                    ROUND(AVG(otpmgndetailswindspeed)) as speed
                FROM bmsmgmtprodv13.otpmgndetails 
                where FROM_UNIXTIME(otpmgndetailspolledtimestamp) >= %s
                and FROM_UNIXTIME(otpmgndetailspolledtimestamp) < %s + interval 1 day
                  AND otpmgndetailsactivepower > 0;
            """
            # Pass parameters safely in a tuple
            cursor.execute(query2, (date_str, date_str))
            avg_data = cursor.fetchone()

    except mysql.connector.Error as e:
        # It's good practice to log the original query and parameters for debugging
        # print(f"Error with query: {query1} or {query2} with params {(date_str, date_str)}")
        raise HTTPException(status_code=500, detail={"error": f"MySQL error: {str(e)}"})
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"An unexpected error occurred: {str(e)}"})

    # Process the data using the same shared helper function
    windJson = _process_wind_data(all_day_data, avg_data)
    
    return windJson


@app.get('/thermaltemp')
def peak_demand_date(db: mysql.connector.connect = Depends(get_bmsdb)):

    if 'thermaltemp' in  bms_cache:
        print("from cache")
        return bms_cache['thermaltemp']
    
    print("Thermal temp from database")
    try:
        processed_db = get_bmsdb()
        ems_cur = processed_db.cursor()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})

    ems_cur.execute("""SELECT tsStoredWaterTemperature / 100 AS StoredWaterTemp
                        FROM bmsmgmtprodv13.thermalStorageMQTTReadings
                        WHERE polledTime >= CURDATE()
                        ORDER BY polledTime DESC
                        LIMIT 1;
                        """)
    res1 = ems_cur.fetchall()

    if len(res1) > 0:
        thermalTemp = res1[0][0]
    else:
        thermalTemp = 0
    
    bms_cache['thermaltemp'] = thermalTemp

    return thermalTemp



@app.get('/wind/powerVSspeedScatter')
def peak_demand_date(db: mysql.connector.connect = Depends(get_bmsdb)):
    windList = []

    if 'windspeedvspower' in bms_cache:
        print("from cache")
        return bms_cache['windspeedvspower']
    
    print("wind speed vs power from DB")

    try:
        processed_db = get_bmsdb()
        ems_cur = processed_db.cursor()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})

    ems_cur.execute("""SELECT otpmgndetailsactivepower,otpmgndetailswindspeed,from_unixtime(otpmgndetailspolledtimestamp)
                        FROM bmsmgmtprodv13.otpmgndetails where date(from_unixtime(otpmgndetailspolledtimestamp)) = curdate()
                        and otpmgndetailswindspeed > 0;""")
    
    res = ems_cur.fetchall()

    for i in res:
        windList.append({'power':i[0],'windspeed':i[1]})

    bms_cache['windspeedvspower'] = windList

    return windList

@app.post('/wind/powerVSspeedScatter/Filtered')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_bmsdb)):
    windList = []

    try:
        value = data.get('date')

        if value and isinstance(value, str):
            with db.cursor() as bms_cur:
                bms_cur.execute(f"""SELECT otpmgndetailsactivepower,otpmgndetailswindspeed,from_unixtime(otpmgndetailspolledtimestamp)
                                    FROM bmsmgmtprodv13.otpmgndetails where date(from_unixtime(otpmgndetailspolledtimestamp)) = '{value}'
                                    and otpmgndetailswindspeed > 0;""")
                
                res = bms_cur.fetchall()

                for i in res:
                    windList.append({'power':i[0],'windspeed':i[1]})

    except mysql.connector.Error as e:
        return JSONResponse(content={"error": "MySQL connection error"}, status_code=500)
    
    return windList

@app.get('/wind/parameters')
def peak_demand_date(db: mysql.connector.connect = Depends(get_bmsdb)):
    windList = []
    if 'windparam' in bms_cache:
        print("from cache")
        return bms_cache['windparam']
    try:
        processed_db = get_bmsdb()
        ems_cur = processed_db.cursor()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    ems_cur.execute("""SELECT otpmgndetailswindspeed,otpmgndetailsnacelledirection,otpmgndetailsambienttemp,round(otpmgndetailsgenspeed,1),
                        round(otpmgndetailsrotorspeed,1) FROM bmsmgmtprodv13.otpmgndetails where date(from_unixtime(otpmgndetailspolledtimestamp)) = curdate() 
                        order by otpmgndetailspolledtimestamp desc limit 1;""")
    
    res = ems_cur.fetchall()

    if len(res) > 0:
        for i in res:
            nacelleDir = getNacelleDir(i[1])
            windList.append({"windSpeed":i[0],"temperature":i[2],"rotorSpeed":i[4],"genSpeed":i[3],
                             "nacelleDirection":nacelleDir})

    bms_cache['windparam'] = windList
    return windList


@app.get('/wind/expVSact')
def peak_demand_date(db: mysql.connector.connect = Depends(get_bmsdb)):
    if 'windExpvsAct' in bms_cache:
        print("from cache")
        return bms_cache['windExpvsAct']
    
    print("from DB")
    windList = []
    try:
        processed_db = get_bmsdb()
        ems_cur = processed_db.cursor()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    ems_cur.execute("""SELECT round(avg(otpmgndetailsactivepower)) as power, round(avg(otpmgndetailswindspeed)) 
                        FROM bmsmgmtprodv13.otpmgndetails where date(from_unixtime(otpmgndetailspolledtimestamp)) = curdate() 
                        and otpmgndetailsactivepower > 0 order by otpmgndetailspolledtimestamp;""")
    
    res = ems_cur.fetchall()

    for i in res:
        speed = wind_round(i[1])
        expected = windSpeed[speed]
        windList.append({"expectedSpeed":20,"windSpeed":i[1],"averagePower":i[0],"expexctedPower":expected})
    
    bms_cache['windExpvsAct'] = windList

    return windList


@app.post('/wind/expVSact/Filtered')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_bmsdb)):
    windList = []
    try:
        value = data.get('date')

        if value and isinstance(value, str):
            with db.cursor() as bms_cur:
                bms_cur.execute(f"""SELECT round(avg(otpmgndetailsactivepower)) as power, round(avg(otpmgndetailswindspeed)) 
                        FROM bmsmgmtprodv13.otpmgndetails where date(from_unixtime(otpmgndetailspolledtimestamp)) = '{value}' 
                        and otpmgndetailsactivepower > 0 order by otpmgndetailspolledtimestamp;""")
    
                res = bms_cur.fetchall()

                for i in res:
                    speed = wind_round(i[1])
                    expected = windSpeed[speed]
                    windList.append({"expectedSpeed":20,"windSpeed":i[1],"averagePower":i[0],"expexctedPower":expected})
    
    except mysql.connector.Error as e:
        return JSONResponse(content={"error": "MySQL connection error"}, status_code=500)

    return windList

@app.get('/wind/speedVSpower')
def peak_demand_date(db: mysql.connector.connect = Depends(get_bmsdb)):
    if 'windSpeedvsPower' in bms_cache:
        print("from cache")
        return bms_cache['windSpeedvsPower']
    windList = []
    try:
        processed_db = get_bmsdb()
        ems_cur = processed_db.cursor()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    ems_cur.execute("""SELECT otpmgndetailsactivepower*0.60 as power, otpmgndetailswindspeed,
                    from_unixtime(otpmgndetailspolledtimestamp) FROM bmsmgmtprodv13.otpmgndetails
                    where date(from_unixtime(otpmgndetailspolledtimestamp)) = curdate() order by otpmgndetailspolledtimestamp;""")
    
    res = ems_cur.fetchall()

    for i in res:
        polledTime = str(i[2])[11:16]
        if i[0] != None and i[0] >= 0:
            windList.append({"polledTime":polledTime,"activePower":i[0],"windSpeed":i[1]})
        else:
            windList.append({"polledTime":polledTime,"activePower":0,"windSpeed":i[1]})

    bms_cache['windSpeedvsPower'] = windList

    return windList

@app.post('/wind/speedVSpower/Filtered')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_bmsdb)):
    windList = []
    try:
        value = data.get('date')

        if value and isinstance(value, str):
            with db.cursor() as bms_cur:
                bms_cur.execute(f"""SELECT round(otpmgndetailsactivepower*0.60,2) as power, otpmgndetailswindspeed,
                    from_unixtime(otpmgndetailspolledtimestamp) FROM bmsmgmtprodv13.otpmgndetails
                    where date(from_unixtime(otpmgndetailspolledtimestamp)) = '{value}' order by otpmgndetailspolledtimestamp;""")
                
                res= bms_cur.fetchall()

                for i in res:
                    polledTime = str(i[2])[11:16]
                    if i[0] != None and i[0] >= 0:
                        windList.append({"polledTime":polledTime,"activePower":i[0],"windSpeed":i[1]})
                    else:
                        windList.append({"polledTime":polledTime,"activePower":0,"windSpeed":i[1]})

    except mysql.connector.Error as e:
        return JSONResponse(content={"error": "MySQL connection error"}, status_code=500)

    return windList

@app.post('/PeakDemand/Analysis/Count/Peak/Filtered')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_bmsdb)):
    peaklis = []
    try:
        value = data.get('date')
        peak = data.get('peak')

        if value and peak and isinstance(value, str):
            with db.cursor() as bms_cur:
                awsdb = get_emsdb()
                awscur = awsdb.cursor()

                awscur.execute("SELECT maxAvgPeak FROM EMS.peakShavingLogic where date(polledTime) = curdate() order by polledTime desc limit 1;")

                peakMax = awscur.fetchall()

                maxAvg = peakMax[0][0]

                maxAvg = round(maxAvg)

                GdmaxAvg = maxAvg - ((maxAvg*5)/100)

                peak = round(peak)

                bms_cur.execute(f"""SELECT COUNT(totalApparentPower2) 
                                    FROM bmsmgmt_olap_prod_v13.hvacSchneider7230Polling
                                    WHERE polledTime >= '{value} 00:00:00'
                                    AND polledTime <= '{value} 23:59:59'
                                    AND totalApparentPower2 >= {peak};
                                    """)

                maxres = bms_cur.fetchall()

                maxCount = maxres[0][0]

                bms_cur.execute(f"""SELECT COUNT(totalApparentPower2)
                                    FROM bmsmgmt_olap_prod_v13.hvacSchneider7230Polling
                                    WHERE polledTime >= '{value} 00:00:00'
                                    AND polledTime <= '{value} 23:59:59'
                                    AND totalApparentPower2 < {peak};
                                    """)

                minres = bms_cur.fetchall()

                minCount = minres[0][0]

                totalCount = minCount+maxCount

                maxPr = (maxCount/totalCount)*100
                minPr = (minCount/totalCount)*100

                peaklis.append({'limit':peak,'maxCount':maxCount,'minCount':minCount,'maxpr':maxPr,'minpr':minPr,
                                'thresholdlimit':maxAvg,'graduallimit':GdmaxAvg})

    except mysql.connector.Error as e:
        return JSONResponse(content={"error": "MySQL connection error"}, status_code=500)

    return peaklis


@app.get('/PeakDemand/Analysis/Count')
def peak_demand_date(db: mysql.connector.connect = Depends(get_bmsdb)):
    if 'peakCount' in bms_cache:
        print("from cache")
        return bms_cache['peakCount']
    peaklis=[]
    try:
        processed_db = get_bmsdb()
        awsdb = get_emsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    

    awscur = awsdb.cursor()
    bms_cur = processed_db.cursor()

    awscur.execute("SELECT maxAvgPeak FROM EMS.peakShavingLogic where date(polledTime) = curdate() order by polledTime desc limit 1;")

    peakMax = awscur.fetchall()

    maxAvg = peakMax[0][0]

    maxAvg = round(maxAvg)

    GdmaxAvg = maxAvg - ((maxAvg*5)/100)

    bms_cur.execute(f"""SELECT COUNT(totalApparentPower2)
                        FROM bmsmgmt_olap_prod_v13.hvacSchneider7230Polling
                        WHERE polledTime >= CURDATE()
                        AND polledTime < CURDATE() + INTERVAL 1 DAY
                        AND totalApparentPower2 >= {maxAvg};
                        """)

    maxres = bms_cur.fetchall()

    maxCount = maxres[0][0]

    bms_cur.execute(f"""SELECT COUNT(totalApparentPower2)
                        FROM bmsmgmt_olap_prod_v13.hvacSchneider7230Polling
                        WHERE polledTime >= CURDATE()
                        AND polledTime < CURDATE() + INTERVAL 1 DAY
                        AND totalApparentPower2 < {maxAvg};
                        """)

    minres = bms_cur.fetchall()

    minCount = minres[0][0]

    totalCount = minCount+maxCount

    maxPr = (maxCount/totalCount)*100
    minPr = (minCount/totalCount)*100

    peaklis.append({'limit':GdmaxAvg,'maxCount':maxCount,'minCount':minCount,'maxpr':maxPr,'minpr':minPr,'thresholdlimit':maxAvg,
                    'GradualLimit':GdmaxAvg})

    bms_cache['peakCount'] = peaklis
    return peaklis


@app.post('/PeakDemand/Analysis/Count/Filtered')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_bmsdb)):
    peaklis = []

    try:
        value = data.get('date')

        if value and isinstance(value, str):
            with db.cursor() as bms_cur:
                try:
                    awsdb = get_emsdb()
                except Exception as e:
                    raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
                
                awscur = awsdb.cursor()

                awscur.execute(f"SELECT maxAvgPeak FROM EMS.peakShavingLogic where date(polledTime) = '{value}' order by polledTime desc limit 1;")

                peakMax = awscur.fetchall()

                maxAvg = peakMax[0][0]

                maxAvg = round(maxAvg)

                GdmaxAvg = maxAvg - ((maxAvg*5)/100)

                bms_cur.execute(f"""SELECT COUNT(totalApparentPower2)
                                    FROM bmsmgmt_olap_prod_v13.hvacSchneider7230Polling
                                    WHERE polledTime >= '{value} 00:00:00'
                                    AND polledTime < DATE_ADD('{value} 00:00:00', INTERVAL 1 DAY)
                                    AND totalApparentPower2 >= {maxAvg};""")

                maxres = bms_cur.fetchall()

                maxCount = maxres[0][0]

                bms_cur.execute(f"""SELECT COUNT(totalApparentPower2)
                                    FROM bmsmgmt_olap_prod_v13.hvacSchneider7230Polling
                                    WHERE polledTime >= '{value} 00:00:00'
                                    AND polledTime < DATE_ADD('{value} 00:00:00', INTERVAL 1 DAY)
                                    AND totalApparentPower2 < {maxAvg};""")

                minres = bms_cur.fetchall()

                minCount = minres[0][0]

                totalCount = minCount+maxCount

                maxPr = (maxCount/totalCount)*100
                minPr = (minCount/totalCount)*100

                peaklis.append({'limit':maxAvg,'maxCount':maxCount,'minCount':minCount,'maxpr':maxPr,'minpr':minPr,
                                'thresholdlimit':maxAvg,'GradualLimit':GdmaxAvg})

    except mysql.connector.Error as e:
        return JSONResponse(content={"error": "MySQL connection error"}, status_code=500)

    return peaklis


@app.get('/PeakDemand/Maximum')
def peak_demand_date(db: mysql.connector.connect = Depends(get_bmsdb)):
    if 'peakMax' in bms_cache:
        print("from cache")
        return bms_cache['peakMax']
    MaximumDemand=[]
    try:
        processed_db = get_bmsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
   
    bms_cur = processed_db.cursor()

    bms_cur.execute("""SELECT totalApparentPower2, polledTime
                        FROM bmsmgmt_olap_prod_v13.hvacSchneider7230Polling
                        WHERE polledTime >= CURDATE()
                        AND polledTime < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
                        AND totalApparentPower2 = (
                                SELECT MAX(totalApparentPower2)
                                FROM bmsmgmt_olap_prod_v13.hvacSchneider7230Polling
                                WHERE polledTime >= CURDATE()
                                AND polledTime < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
                                AND totalApparentPower2 <= 5000
                            );""")
   
    res = bms_cur.fetchall()

    for i in res:
        polledTime = str(i[1])[11:19]
        if(i[0]==None):
            totalApparentPower2=0
        else:
            totalApparentPower2=round(i[0],2)
        MaximumDemand.append({'totalApparentPower2':totalApparentPower2,"PolledTime":polledTime})
    
    bms_cache['peakMax'] = MaximumDemand
    return MaximumDemand

@app.post('/PeakDemand/Maximum/Filtered')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_bmsdb)):
    MaximumDemand = []
    try:
        value = data.get('date')

        if value and isinstance(value, str):
            with db.cursor() as bms_cur:

                bms_cur.execute(f"""SELECT totalApparentPower2, polledTime
                                    FROM bmsmgmt_olap_prod_v13.hvacSchneider7230Polling
                                    WHERE polledTime >= '{value} 00:00:00'
                                    AND polledTime < DATE_ADD('{value} 00:00:00', INTERVAL 1 DAY)
                                    AND totalApparentPower2 = (
                                            SELECT MAX(totalApparentPower2)
                                            FROM bmsmgmt_olap_prod_v13.hvacSchneider7230Polling
                                            WHERE polledTime >= '{value} 00:00:00'
                                            AND polledTime < DATE_ADD('{value} 00:00:00', INTERVAL 1 DAY)
                                            AND totalApparentPower2 <= 5000
                                        );""")
   
                res = bms_cur.fetchall()

                # print(res)

                for i in res:
                    polledTime = str(i[1])[11:19]
                    if(i[0]==None):
                        totalApparentPower2=0
                    else:
                        totalApparentPower2=round(i[0],2)
                    
                    MaximumDemand.append({'totalApparentPower2':totalApparentPower2,"PolledTime":polledTime})

    except mysql.connector.Error as e:
        return JSONResponse(content={"error": "MySQL connection error"}, status_code=500)

    return MaximumDemand

@app.get('/thermal/dashboardSummary')
def peak_demand_min():
    if 'thermalDashSumm' in bms_cache:
        print("from cache")
        return bms_cache['thermalDashSumm']
    
    thermal_list = []
    try:
        processed_db = get_bmsdb()
        awsdb = get_emsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})

    bms_cur = processed_db.cursor()
    awscur = awsdb.cursor()

    bms_cur.execute("""SELECT 
                        thermalStorageInlet / 100 AS thermalStorageInlet,
                        thermalStorageOutlet / 100 AS thermalStorageOutlet,
                        tsStoredWaterTemperature / 100 AS tsStoredWaterTemperature,
                        ADPValve,
                        BDPValve,
                        HValve
                    FROM bmsmgmtprodv13.thermalStorageMQTTReadings
                    WHERE polledTime >= CURDATE()
                    AND polledTime < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
                    AND ADPValve > 0
                    ORDER BY recordId DESC
                    LIMIT 1;""")

    thermalres= bms_cur.fetchall()

    if len(thermalres) > 0:
        tsIn = thermalres[0][0]
        tsOut = thermalres[0][1]
        tsSt = thermalres[0][2]
        ADPvalve = thermalres[0][3]
        BDPvalve = thermalres[0][4]
        Hvalve = thermalres[0][5]

        if ADPvalve == 1 and BDPvalve ==1 and Hvalve == 1:
            status = 'DCHG'
        else:
            status = 'IDLE'
    else:
        tsIn = None
        tsOut = None
        tsSt = None
        status = None

    awscur.execute("SELECT sum(coolingEnergy),sum(ChargingEnergy) FROM EMS.ThermalHourly where date(polledTime) = curdate();")

    energyRes = awscur.fetchall()

    if len(energyRes) > 0:
        coolingEnergy = energyRes[0][0]
        chargingEnergy = energyRes[0][1]
    else:
        coolingEnergy = None
        chargingEnergy = None

    thermal_list.append({'tsInletTemperature':tsIn,'tsOutletTemperature':tsOut,'tsStoredWaterTemperature':tsSt,
                         'coolingEnergy':coolingEnergy,'chargingEnergy':chargingEnergy,'Status':status})
    
    bms_cache['thermalDashSumm'] = thermal_list
    return thermal_list
    

@app.get('/thermal/summaryCard')
def peak_demand_min():
    if 'thermalSumm' in bms_cache:
        print("from cache")
        return bms_cache['thermalSumm']

    thermal_list = []
    try:
        processed_db = get_bmsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})

    bms_cur = processed_db.cursor()

    bms_cur.execute("""SELECT 
                        tsStoredWaterTemperature,
                        thermalStorageInlet,
                        thermalStorageOutlet,
                        linePressHigh,
                        dischargingFlowrate,
                        ADPValve,
                        BDPValve,
                        HValve,
                        actuatorPosition,
                        actualChargingFlowrate,
                        polledTime
                    FROM bmsmgmtprodv13.thermalStorageMQTTReadings
                    WHERE polledTime >= CURDATE()
                    AND polledTime < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
                    ORDER BY recordId DESC
                    LIMIT 1;
                    """)

    thermalres= bms_cur.fetchall()

    try:
        tsstored = thermalres[0][0]/100
    except:
        tsstored = None
    try:
        tsInlet = thermalres[0][1]/100
    except:
        tsInlet = None
    try:
        tsOultlet = thermalres[0][2]/100
    except:
        tsOultlet = None
    try:
        linePress = thermalres[0][3]/100
    except:
        linePress = None
    try:
        flowrate = thermalres[0][4]
    except:
        flowrate = None
    try:
        flowrateTS = round(thermalres[0][9]/100,3)
    except:
        flowrateTS = None
    try:
        Adpvalve = thermalres[0][5]
    except:
        Adpvalve = None
    try:
        Bdpvalve = thermalres[0][6]
    except:
        Bdpvalve = None
    try:
        Hvalve = thermalres[0][7]
    except:
        Hvalve = None
    try:
        actuator = thermalres[0][8]
    except:
        actuator = None

    bms_cur.execute("""SELECT 
                        chargingPump1Power,
                        chargingPump2Power,
                        dischargingPump1Power,
                        dischargingPump2Power
                    FROM bmsmgmt_olap_prod_v13.hvacChillerElectricPolling
                    WHERE polledTime >= CURDATE()
                    AND polledTime < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
                    ORDER BY polledTime DESC
                    LIMIT 1;""")

    statusres = bms_cur.fetchall()

    try:
        chargingpump1 = statusres[0][0]
    except:
        chargingpump1 = None
    try:
        chargingpump2 = statusres[0][1]
    except:
        chargingpump2 = None
    try:
        dischargingpump1 = statusres[0][2]
    except:
        dischargingpump1 = None
    try:
        dischargingpump2 = statusres[0][3]
    except:
        dischargingpump2 = None


    def calculate_percentage(x):
        return ((15 - x) / (15 - 7)) * 100
    
    if tsstored != None:
        EnergyPercentage = calculate_percentage(tsstored)
    else:
        EnergyPercentage = None


    thermal_list.append({"storedwatertemperature":tsstored,"inletTemparature":tsInlet,"outletTemparature":tsOultlet,
                         "thermalStoragelinepressure":linePress,"flowrateToBuilding":flowrate,"flowrateToTS":flowrateTS,
                         "ADPvalveStatus":Adpvalve,"BDPvalveStatus":Bdpvalve,"HvalveStatus":Hvalve,"ActuvatorStatus":actuator,
                         'EnergyPercentage':EnergyPercentage,"chargingPump1Power":chargingpump1,"chargingPump2Power":chargingpump2,
                         'dischargingpump1':dischargingpump1,'dischargingpump2':dischargingpump2,"polledTime":thermalres[0][10]})
    
    bms_cur.close()
    processed_db.close()

    bms_cache['thermalSumm'] = thermal_list

    return thermal_list
    

@app.get('/peakDemandmin')
def peak_demand_min():
    if 'peakDemandmin' in bms_cache:
        print("from cache")
        return bms_cache['peakDemandmin']

    peak_list = []
    try:
        processed_db = get_bmsdb()
        awsdb = get_emsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})

    bms_cur = processed_db.cursor()
    awscur = awsdb.cursor()

    awscur.execute("SELECT round(maxAvgPeak) FROM EMS.peakShavingLogic where date(polledTime) = curdate() order by polledTime desc limit 1;")

    maxAvgres = awscur.fetchall()

    if len(maxAvgres) > 0:
        maxAvg = maxAvgres[0][0]
    else:
        maxAvg = 4000

    safeLimit = maxAvg - ((maxAvg*5)/100)

    bms_cur.execute("""SELECT polledTime, totalApparentPower2
                        FROM bmsmgmt_olap_prod_v13.hvacSchneider7230Polling
                        WHERE polledTime >= CURDATE()
                        AND polledTime < DATE_ADD(CURDATE(), INTERVAL 1 DAY);
                        """)

    peaks = bms_cur.fetchall()

    for i in peaks:
        if i[1] is not None:
            polled_time = str(i[0])[11:16]
            peak_list.append({'polledTime': polled_time, 'peakdemand': round(i[1], 2), 'limitline': maxAvg, 'safeLimit':safeLimit})
        else:
            polled_time = str(i[0])[11:16]
            peak_list.append({'polledTime': polled_time, 'peakdemand': None, 'limitline': maxAvg, 'safeLimit':safeLimit})

    bms_cur.close()
    processed_db.close()

    bms_cache['peakDemandmin'] = peak_list

    return peak_list

@app.post('/peakDemandDate')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_bmsdb)):
    peak_list = []

    try:
        value = data.get('date')

        try:
            awsdb = get_emsdb()
        except Exception as e:
            raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})

        if value and isinstance(value, str):
            with db.cursor() as bms_cur:

                awscur = awsdb.cursor()

                awscur.execute(f"SELECT round(maxAvgPeak) FROM EMS.peakShavingLogic where date(polledTime) = '{value}' order by polledTime desc limit 1;")

                maxAvgres = awscur.fetchall()

                if len(maxAvgres) >0:
                    maxAvg = maxAvgres[0][0]
                else:
                    maxAvg = 4000
                
                safeLimit = maxAvg - ((maxAvg*1)/100)

                bms_cur.execute(f"""SELECT polledTime, totalApparentPower2
                                    FROM bmsmgmt_olap_prod_v13.hvacSchneider7230Polling
                                    WHERE polledTime >= '{value} 00:00:00'
                                    AND polledTime < DATE_ADD('{value}', INTERVAL 1 DAY);""")

                peaks = bms_cur.fetchall()

                for i in peaks:
                    if i[1] is not None:
                        polled_time = str(i[0])[11:16]
                        peak_list.append({'polledTime': polled_time, 'peakdemand': round(i[1], 2), 'limitline': maxAvg, 'safeLimit':safeLimit})
                    else:
                        polled_time = str(i[0])[11:16]
                        peak_list.append({'polledTime': polled_time, 'peakdemand': None, 'limitline': maxAvg, 'safeLimit':safeLimit})


                bms_cur.close()

    
    except mysql.connector.Error as e:
        return JSONResponse(content={"error": "MySQL connection error"}, status_code=500)

    return peak_list


@app.get('/grid/initialgraph')
def peak_demand_min():
    if 'gridinit' in bms_cache:
        print("from cache")
        return bms_cache['gridinit']
    
    grid_list = []
    try:
        processed_db = get_emsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})

    bms_cur = processed_db.cursor()

    bms_cur.execute("""SELECT polledDate, Energy
                        FROM EMS.GridProcessed
                        WHERE polledDate BETWEEN DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND CURDATE();
                        """)

    grids = bms_cur.fetchall()

    for i in grids:
        if i[1] is not None:
            polled_time = str(i[0])
            grid_list.append({'polledTime': polled_time, 'grid': round(i[1], 2)})

    bms_cur.close()
    processed_db.close()

    bms_cache['gridinit'] = grid_list

    return grid_list


@app.post('/grid/filter')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_emsdb)):
    grid_list = []

    try:
        value1 = data.get('date')
        value2 = data.get('endDate')

        if value1 and value2 and isinstance(value1, str) and isinstance(value2, str):
            with db.cursor() as bmscur:

                bmscur.execute(
                        "SELECT polledDate, Energy FROM EMS.GridProcessed WHERE polledDate BETWEEN %s AND %s;",
                        (value1, value2))


                grids = bmscur.fetchall()

                for i in grids:
                    if i[1] is not None:
                        polled_time = str(i[0])
                        grid_list.append({'polledTime': polled_time, 'grid': round(i[1], 2)})

        elif value1 and isinstance(value1, str):
            with db.cursor() as bmscur:

                query = """
                    SELECT polledDate, Energy 
                    FROM EMS.GridProcessed 
                    WHERE polledDate BETWEEN %s AND CURDATE();
                """
                bmscur.execute(query, (value1,))


                peaks = bmscur.fetchall()

                for i in peaks:
                    if i[1] is not None:
                        polled_time = str(i[0])
                        grid_list.append({'polledTime': polled_time, 'grid': round(i[1], 2)})

    except mysql.connector.Error as e:
        return JSONResponse(content={"error": "MySQL connection error"}, status_code=500)

    return grid_list


@app.get('/peak/initialgraph')
def peak_demand_min():
    if 'peakinit' in bms_cache:
        print("from cache")
        return bms_cache['peakinit']
    
    peak_list = []
    try:
        processed_db = get_emsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})

    bms_cur = processed_db.cursor()

    bms_cur.execute("SELECT polledTime, peakdemand FROM EMS.peakdemanddaily where polledTime >= date_sub(curdate(), interval 6 day)  and polledTime <= curdate();")

    peaks = bms_cur.fetchall()

    for i in peaks:
        if i[1] is not None:
            polled_time = str(i[0])
            peak_list.append({'polledTime': polled_time, 'peakdemand': round(i[1], 2)})

    bms_cur.close()
    processed_db.close()

    bms_cache['peakinit'] = peak_list

    return peak_list


@app.post('/peak/filter')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_emsdb)):
    peak_list = []

    try:
        value1 = data.get('date')
        value2 = data.get('endDate')

        if value1 and value2 and isinstance(value1, str) and isinstance(value2, str):
            with db.cursor() as bmscur:

                bmscur.execute(
                    "SELECT polledTime,peakdemand FROM EMS.peakdemanddaily where polledTime >= %s and polledTime <= %s;",(value1,value2)
                )

                peaks = bmscur.fetchall()

                for i in peaks:
                    if i[1] is not None:
                        polled_time = str(i[0])
                        peak_list.append({'polledTime': polled_time, 'peakdemand': round(i[1], 2)})

        elif value1 and isinstance(value1, str):
            with db.cursor() as bmscur:

                bmscur.execute(
                    "SELECT polledTime,peakdemand FROM EMS.peakdemanddaily where polledTime >= %s and polledTime <= curdate();",(value1,)
                )

                peaks = bmscur.fetchall()

                for i in peaks:
                    if i[1] is not None:
                        polled_time = str(i[0])
                        peak_list.append({'polledTime': polled_time, 'peakdemand': round(i[1], 2)})

    except mysql.connector.Error as e:
        return JSONResponse(content={"error": "MySQL connection error"}, status_code=500)

    return peak_list


@app.get('/chillerstatus')
def peak_demand_date(db: mysql.connector.connect = Depends(get_emsdb)):
    chiller_list = []
    try:
        processed_db = get_emsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    bms_cur = processed_db.cursor()

    bms_cur.execute("""SELECT chiller1, chiller2, chiller3, chiller4, chiller5, chiller6, chiller7, chiller8
                        FROM EMS.ChillerStatus
                        WHERE polledTime >= CURDATE()
                        AND polledTime < CURDATE() + INTERVAL 1 DAY
                        ORDER BY polledTime DESC
                        LIMIT 1;""")

    res = bms_cur.fetchall()

    for i in res:
        chiller_list.append({'chiller1':i[0],'chiller2':i[1],'chiller3':i[2],'chiller4':i[3],
                             'chiller5':i[4],'chiller6':i[5],'chiller7':i[6],'chiller8':i[7]})
        
    bms_cur.close()
    processed_db.close()
    
    return chiller_list

@app.get('/BuildingConsumptionPage2')
def peak_demand_date(db: mysql.connector.connect = Depends(get_emsdb)):
    if 'building2' in bms_cache:
        print("from cache")
        return bms_cache['building2']

    building_list = []
    try:
        processed_db = get_emsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    bms_cur = processed_db.cursor()

    bms_cur.execute("SELECT polledTime,gridEnergy,rooftopEnergy,wheeledinEnergy,thermalDischarge,peakDemand FROM EMS.buildingConsumption where date(polledTime) = curdate() order by polledTime;")

    res = bms_cur.fetchall()

    for i in res:
        polledTime = str(i[0])[11:16]
        thermalDischarge = i[4]
        if thermalDischarge == None:
            thermalDischarge = 0
        else:
            thermalDischarge = abs(thermalDischarge)
        building_list.append({'Timestamp':polledTime,'GridEnergy':i[1],'RooftopEnergy':i[2],
                              'WheeledInSolar':i[3],'thermalDischarge':thermalDischarge})
        
    bms_cur.close()
    processed_db.close()
    
    bms_cache['building2'] = building_list

    return building_list


@app.post('/filteredGraph/BuildingConsumptionPage2')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_emsdb)):
    building_list = []

    try:
        value = data.get('date')
        #print(value,type(value))

        if value and isinstance(value, str):
            with db.cursor() as bmscur:
                
                bmscur.execute(
                    f"SELECT polledTime,gridEnergy,rooftopEnergy,wheeledinEnergy,thermalDischarge FROM EMS.buildingConsumption where date(polledTime) = '{value}' order by polledTime;")

                res = bmscur.fetchall()

                for i in res:
                    polledTime = str(i[0])[11:16]
                    thermalDischarge = i[4]
                    if thermalDischarge == None:
                        thermalDischarge = 0
                    else:
                        thermalDischarge = abs(thermalDischarge)
                    building_list.append({'Timestamp':polledTime,'GridEnergy':i[1],'RooftopEnergy':i[2],
                                        'WheeledInSolar':i[3],'thermalDischarge':thermalDischarge})
    except mysql.connector.Error as e:
        return JSONResponse(content={"error": ["MySQL connection error",e]}, status_code=500)
    
    #print(building_list)
    return building_list

@app.get('/buildingConsumptionHighlights')
def peak_demand_date(db: mysql.connector.connect = Depends(get_emsdb)):
    if 'buildinghighlight' in bms_cache:
        print("from cache")
        return bms_cache['buildinghighlight']
    
    building_list = []
    try:
        processed_db = get_emsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    bms_cur = processed_db.cursor()

    bms_cur.execute("""SELECT
                            SUM(gridEnergy) AS totalGridEnergy,
                            SUM(gridEnergy) AS totalGridEnergy,
                            SUM(rooftopEnergy) AS totalRooftopEnergy,
                            SUM(wheeledinEnergy) AS totalWheeledInEnergy,
                            SUM(wheeledinEnergy2) AS totalWheeledInEnergy2,
                            SUM(windEnergy) AS totalWindEnergy,
                            SUM(diesel) AS totalDiesel,
                            MAX(peakDemand) AS maxPeakDemand
                        FROM EMS.buildingConsumption
                        WHERE DATE(polledTime) = CURDATE();
                        """)
    
    res = bms_cur.fetchall()
    grid = 0

    for i in res:
        if i[1] != None:
            if i[3] != None:
                grid = i[1]-i[3]
            if i[4] != None:
                grid = grid-i[4]
            if i[5] != None:
                grid = round(grid-i[5])
            
            if grid < 0:
                grid = 0
            building_list.append({'gridEnergy':grid,'rooftopEnergy':i[2],'wheeledinEnergy':i[3],'wheeledinEnergy2':i[4],
                              'windEnergy':i[5],'peakDemand':i[7],'Diesel':i[6]})
        else:
            building_list.append({'gridEnergy':i[1],'rooftopEnergy':i[2],'wheeledinEnergy':i[3],'wheeledinEnergy2':i[4],
                              'windEnergy':i[5],'peakDemand':i[7],'Diesel':i[6]})
    
    bms_cur.close()
    processed_db.close()

    bms_cache['buildinghighlight'] = building_list

    return building_list

@app.post('/filtered/buildingConsumptionHighlights')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_emsdb)):
    building_list = []

    try:
        value = data.get('date')

        if value and isinstance(value, str):
            with db.cursor() as bmscur:
                bmscur.execute(f"""SELECT
                                    SUM(gridEnergy) AS totalGridEnergy,
                                    SUM(gridEnergy) AS totalGridEnergy,
                                    SUM(rooftopEnergy) AS totalRooftopEnergy,
                                    SUM(wheeledinEnergy) AS totalWheeledInEnergy,
                                    SUM(wheeledinEnergy2) AS totalWheeledInEnergy2,
                                    SUM(windEnergy) AS totalWindEnergy,
                                    SUM(diesel) AS totalDiesel,
                                    MAX(peakDemand) AS maxPeakDemand
                                FROM EMS.buildingConsumption
                                WHERE polledTime >= '{value} 00:00:00' 
                                AND polledTime <= '{value} 23:59:59';
                                """)

                res = bmscur.fetchall()

                for i in res:
                    if i[1] != None:
                        if i[3] != None:
                            grid = i[1]-i[3]
                        if i[4] != None:
                            grid = grid-i[4]
                        if i[5] != None:
                            grid = grid-i[5]
                        
                        if grid < 0:
                            grid = 0
                        building_list.append({'gridEnergy':grid,'rooftopEnergy':i[2],'wheeledinEnergy':i[3],'wheeledinEnergy2':i[4],
                                        'windEnergy':i[5],'peakDemand':i[7],'Diesel':i[6]})
                    else:
                        building_list.append({'gridEnergy':i[1],'rooftopEnergy':i[2],'wheeledinEnergy':i[3],'wheeledinEnergy2':i[4],
                                        'windEnergy':i[5],'peakDemand':i[7],'Diesel':i[6]})
    
    except mysql.connector.Error as e:
        return JSONResponse(content={"error": ["MySQL connection error",e]}, status_code=500)

    return building_list

@app.get('/Ltoanalytics/energy_VS_packsoc')
def peak_demand_date(db: mysql.connector.connect = Depends(get_emsdb)):
    if 'ltoEnervspac' in bms_cache:
        print("from cache")
        return bms_cache['ltoEnervspac']
    
    lto_list = []
    try:
        processed_db = get_emsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    bms_cur = processed_db.cursor()

    bms_cur.execute("""SELECT polledTime, Energy, packSoc, batterySts
                    FROM EMS.LTOMinWise
                    WHERE polledTime >= CURDATE() 
                    AND polledTime < CURDATE() + INTERVAL 1 DAY;
                    """)
    
    res = bms_cur.fetchall()

    for i in res:
        polledTime = str(i[0])[11:16]
        lto_list.append({'packsoc':i[2],'batteryEnergy':i[1],'timestamp':polledTime,'batteryStatus':i[3]})

    bms_cur.close()
    processed_db.close()

    bms_cache['ltoEnervspac'] = lto_list

    return lto_list    
    

@app.post('/filtered/Ltoanalytics/energy_VS_packsoc')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_emsdb)):
    lto_list = []

    try:
        value = data.get('date')

        if value and isinstance(value, str):
            with db.cursor() as bmscur:
                bmscur.execute(f"""SELECT polledTime, Energy, packSoc, batterySts
                                    FROM EMS.LTOMinWise
                                    WHERE polledTime >= '{value} 00:00:00'
                                    AND polledTime <  '{value}' + INTERVAL 1 DAY;
                                    """)

                res = bmscur.fetchall()

                for i in res:
                    polledTime = str(i[1])[11:16]
                    polledTime = str(i[0])[11:16]
                    lto_list.append({'packsoc':i[2],'batteryEnergy':i[1],'timestamp':polledTime,'batteryStatus':i[3]})
                    

    except mysql.connector.Error as e:
        return JSONResponse(content={"error": ["MySQL connection error",e]}, status_code=500)

    return lto_list

@app.get('/current_VS_voltage/LTOBattery')
def peak_demand_date(db: mysql.connector.connect = Depends(get_bmsdb)):
    if 'ltoCurvsVol' in bms_cache:
        print("from cache")
        return bms_cache['ltoCurvsVol']
    
    lto_list = []
    try:
        processed_db = get_bmsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    bms_cur = processed_db.cursor()

    bms_cur.execute("""SELECT recordTimestamp,
                        batteryVoltage,
                        batteryCurrent,
                        HOUR(recordTimestamp) AS hr,
                        MINUTE(recordTimestamp) AS mint
                    FROM bmsmgmtprodv13.ltoBatteryData
                    WHERE recordTimestamp >= CURDATE()
                    AND recordTimestamp < CURDATE() + INTERVAL 1 DAY
                    GROUP BY hr, mint;
                    """)
    
    res = bms_cur.fetchall()

    for i in res:
        polledTime = str(i[0])[11:16]
        lto_list.append({'polledTime':polledTime,'BatteryVoltage':i[1],'BatteryCurrent':i[2]})

    bms_cur.close()
    processed_db.close()

    bms_cache['ltoCurvsVol'] = lto_list

    return lto_list


@app.post('/filtered/current_VS_voltage/LTOBattery')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_bmsdb)):
    lto_list = []

    try:
        value = data.get('date')

        if value and isinstance(value, str):
            with db.cursor() as bmscur:
                bmscur.execute(f"""SELECT recordTimestamp,
                                    batteryVoltage,
                                    batteryCurrent,
                                    HOUR(recordTimestamp) AS hr,
                                    MINUTE(recordTimestamp) AS mint
                                FROM bmsmgmtprodv13.ltoBatteryData
                                WHERE recordTimestamp >= '{value} 00:00:00'
                                AND recordTimestamp < '{value}' + INTERVAL 1 DAY
                                GROUP BY hr, mint;
                                """)

                res = bmscur.fetchall()

                for i in res:
                    polledTime = str(i[0])[11:16]
                    lto_list.append({'polledTime':polledTime,'BatteryVoltage':i[1],'BatteryCurrent':i[2]})

    except mysql.connector.Error as e:
        return JSONResponse(content={"error": ["MySQL connection error",e]}, status_code=500)

    return lto_list

@app.get("/control/ltobattery")
def get_lto_details(db: mysql.connector.connect = Depends(get_bmsdb)):
    lto_dict = {}

    try:
        bmscur = db.cursor()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"MySQL connection error: {str(e)}")

    query = """
        SELECT recordTimestamp, batteryVoltage, batteryCurrent, mainContactorStatus, 
               prechargeContactorStatus, batteryStatus, packSOC, packUsableSOC
        FROM bmsmgmtprodv13.ltoBatteryData
        WHERE recordTimestamp >= CURRENT_DATE()
        ORDER BY recordId DESC LIMIT 1;
    """

    bmscur.execute(query)
    result = bmscur.fetchone()

    if result:
        lto_dict.update({
            "recordTimestamp": result[0],
            "batteryVoltage": result[1],
            "batteryCurrent": result[2],
            "mainContactorStatus": result[3],
            "prechargeContactorStatus": result[4],
            "batteryStatus": result[5],
            "packSOC": result[6],
            "packUsableSOC": result[7],
        })
    else:
        lto_dict = {key: None for key in [
            "recordTimestamp", "batteryVoltage", "batteryCurrent", 
            "mainContactorStatus", "prechargeContactorStatus", "batteryStatus", 
            "packSOC", "packUsableSOC"
        ]}

    bmscur.close()
    db.close()

    return [lto_dict]

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=5001) #,ssl_keyfile="key.pem", ssl_certfile="cert.pem")
