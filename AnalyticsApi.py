from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
import mysql.connector
from fastapi.responses import JSONResponse
import math
import json
from datetime import datetime
from datetime import datetime, timedelta
from fastapi import Query

app = FastAPI()

origins = [
    "*",
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
        host=data['emsDB']['host'],
        user=data['emsDB']['user'],
        password=data['emsDB']['password'],
        database='EMS',
        port=data['emsDB']['port']
    )
    return db

def get_awsdb():
    db = mysql.connector.connect(
        host=data['awsDB']['host'],
        user=data['awsDB']['user'],
        password=data['awsDB']['password'],
        database='EMS',
        port=data['awsDB']['port']
    )
    return db

def get_meterdb():
    db=mysql.connector.connect(
        host=data['awsDB']['host'],
        user=data['awsDB']['user'],
        password=data['awsDB']['password'],
        database='meterdata',
        port=data['awsDB']['port']
    )
    return db


def custom_round(number):
    last_two_digits = number % 100
    if last_two_digits < 50:
        return (number // 100) * 100
    else:
        return ((number // 100) + 1) * 100

def process_energy_data(data):
    result = {}
    for entity, records in data.items():
        sorted_records = sorted(records, key=lambda x: x['polledTime'])
        total_energy = sum(record['Energy'] for record in sorted_records)

        result[entity] = sorted_records
        result[entity].append({'totalEnergy': total_energy})

    return result



@app.get("/Analysis/EnergyTimeBuckets")
def energy_time_buckets(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100)
):
    try:
        db = get_awsdb()
        cursor = db.cursor(dictionary=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Start and end of month
    start_date = datetime(year, month, 1)
    
    if month == 12:
        end_date = datetime(year + 1, 1, 1) - timedelta(seconds=1)
    else:
        end_date = datetime(year, month + 1, 1) - timedelta(seconds=1)

    query = """
	SELECT 
	    -- 05:00 to 06:00
	    SUM(CASE 
		WHEN TIME(polledTime) >= '05:00:00' AND TIME(polledTime) < '06:00:00' 
		THEN rooftopEnergy ELSE 0 END) AS rooftop_5_6,

	    SUM(CASE 
		WHEN TIME(polledTime) >= '05:00:00' AND TIME(polledTime) < '06:00:00' 
		THEN diesel ELSE 0 END) AS diesel_5_6,

	    -- 06:00 to 10:00
	    SUM(CASE 
		WHEN TIME(polledTime) >= '06:00:00' AND TIME(polledTime) < '10:00:00' 
		THEN rooftopEnergy ELSE 0 END) AS rooftop_6_10,

	    SUM(CASE 
		WHEN TIME(polledTime) >= '06:00:00' AND TIME(polledTime) < '10:00:00' 
		THEN diesel ELSE 0 END) AS diesel_6_10,

	    --  NEW: 10:00 to 18:00
	    SUM(CASE 
		WHEN TIME(polledTime) >= '10:00:00' AND TIME(polledTime) < '18:00:00' 
		THEN rooftopEnergy ELSE 0 END) AS rooftop_10_18,

	    SUM(CASE 
		WHEN TIME(polledTime) >= '10:00:00' AND TIME(polledTime) < '18:00:00' 
		THEN diesel ELSE 0 END) AS diesel_10_18,

	    -- 18:00 to 22:00
	    SUM(CASE 
		WHEN TIME(polledTime) >= '18:00:00' AND TIME(polledTime) < '22:00:00' 
		THEN rooftopEnergy ELSE 0 END) AS rooftop_18_22,

	    SUM(CASE 
		WHEN TIME(polledTime) >= '18:00:00' AND TIME(polledTime) < '22:00:00' 
		THEN diesel ELSE 0 END) AS diesel_18_22,

	    -- 22:00 to 05:00 (overnight)
	    SUM(CASE 
		WHEN TIME(polledTime) >= '22:00:00' OR TIME(polledTime) < '05:00:00' 
		THEN rooftopEnergy ELSE 0 END) AS rooftop_22_5,

	    SUM(CASE 
		WHEN TIME(polledTime) >= '22:00:00' OR TIME(polledTime) < '05:00:00' 
		THEN diesel ELSE 0 END) AS diesel_22_5

	FROM buildingConsumption
	WHERE polledTime BETWEEN %s AND %s;
	"""

    cursor.execute(query, (start_date, end_date))
    result = cursor.fetchone()

    return {
        "month": month,
        "year": year,
        "data": result
    }


@app.get("/zealev/convertor")
def get_convertor_status(db: mysql.connector.connect = Depends(get_emsdb)):

    try:
        ems_db = get_awsdb()
        emscur = ems_db.cursor(dictionary=True)

        # 🔋 Aggregated battery status (strings 1–5, today)
        emscur.execute("""
            SELECT
                CASE
                    WHEN SUM(batteryStatus = 'DCHG') > 0 THEN 'Inverter'
                    WHEN SUM(batteryStatus = 'CHG')  > 0 THEN 'Rectifier'
                    ELSE 'Idle'
                END AS systemMode,

                CASE
                    WHEN SUM(mainContactorStatus = 'ON') > 0 THEN 'ON'
                    ELSE 'OFF'
                END AS mainContactorStatus,

                SUM(batteryCurrent) AS totalBatteryCurrent,
                AVG(batteryVoltage) AS avgBatteryVoltage

            FROM (
                SELECT t.batteryCurrent,
                       t.batteryStatus,
                       t.mainContactorStatus,
                       t.batteryVoltage
                FROM ioeBatteryData t
                JOIN (
                    SELECT strings, MAX(recordId) AS max_id
                    FROM ioeBatteryData
                    WHERE recordTimestamp >= CURDATE()
                      AND strings IN (1,2,3,4,5)
                    GROUP BY strings
                ) latest
                ON t.recordId = latest.max_id
            ) latest_data;
        """)

        battery_data = emscur.fetchone()  # single aggregated row

        # ⚡ Latest converter data (today)
        emscur.execute("""
            SELECT
                afeconvertordcvoltage/1000   AS dcVoltage,
                afeconvertordccurrent/1000   AS dcCurrent,
                afeconvertorvabvoltage/1000  AS vabVoltage,
                afeconvertorvcavoltage/1000  AS vcaVoltage,
                afeconvertorvbcvoltage/1000  AS vbcVoltage,
                afeconvertoriacurrent/1000   AS iaCurrent,
                afeconvertoribcurrent/1000   AS ibCurrent,
                afeconvertoriccurrent/1000   AS icCurrent,
                afeconvertorapparentpower/1000 AS apparentPower,
                afeconvertoractivepower/1000 AS activePower,
                afeconvertorreactivepower/1000 AS reactivePower
            FROM zealev.afeconvertor100kw
            WHERE afeconvertorpolledtime >= CURDATE()
            ORDER BY afeconvertorrecid DESC
            LIMIT 1;
        """)

        convertor_data = emscur.fetchone()

        emscur.execute("""select max((afeconvertordcvoltage/1000)*(afeconvertordccurrent/1000)) as maxdcpower
            from zealev.afeconvertor100kw where afeconvertorpolledtime >= curdate();""")
        
        maxpowerres = emscur.fetchone()

        # 🔥 Merge both dictionaries into ONE
        battery_row = battery_data if battery_data else {}
        convertor_row = convertor_data if convertor_data else {}
        maxpowerres = maxpowerres if convertor_data else {}

        merged = {**battery_row, **convertor_row, **maxpowerres}

        # ✨ Optional: clean float precision
        if "totalBatteryCurrent" in merged:
            merged["totalBatteryCurrent"] = round(merged["totalBatteryCurrent"], 2)

        if "avgBatteryVoltage" in merged:
            merged["avgBatteryVoltage"] = round(merged["avgBatteryVoltage"], 2)

        # 📦 Return as SINGLE JSON LIST
        return [merged]

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"MySQL error: {str(e)}"
        )

    finally:
        try:
            emscur.close()
            ems_db.close()
        except:
            pass


@app.get("/Battery/IOE/CostSavingsCard")
def get_today_cost_savings(db: mysql.connector.connect = Depends(get_emsdb)):

    today_date = datetime.now().strftime("%Y-%m-%d")

    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute("""
            SELECT 
                SUM(Morning_Savings) AS Morning_Savings,
                SUM(Evening_Savings) AS Evening_Savings,
                SUM(Charging_Energy) AS Charging_Energy,
                SUM(Discharging_Energy) AS Discharging_Energy
            FROM EMS.IOE_Cost_Savings
            WHERE polledDate = CURRENT_DATE();
        """)
        result = cursor.fetchone()
        cursor.close()
        db.close()

        if not result or all(v is None for v in result.values()):
            raise HTTPException(status_code=404, detail="No data found for the current date")

        return JSONResponse(content={
            "Date": today_date,
            "Morning_Savings": round(result["Morning_Savings"], 2) if result["Morning_Savings"] else 0,
            "Evening_Savings": round(result["Evening_Savings"], 2) if result["Evening_Savings"] else 0,
            "Charging_Energy": round(result["Charging_Energy"], 2) if result["Charging_Energy"] else 0,
            "Discharging_Energy": round(result["Discharging_Energy"], 2) if result["Discharging_Energy"] else 0
        })

    except mysql.connector.Error as e:
        raise HTTPException(status_code=500, detail=f"MySQL query failed: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")



@app.post("/Battery/IOE/CostSavingsCardByDate")
def get_cost_savings_by_date(data: dict, db: mysql.connector.connect = Depends(get_emsdb)):
    
    try:
        value = data.get('date')
        if not value or not isinstance(value, str):
            raise HTTPException(status_code=400, detail="Invalid or missing 'date' field. Use YYYY-MM-DD format.")

        # Validate date format
        try:
            datetime.strptime(value, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

        cursor = db.cursor(dictionary=True)

        cursor.execute("""
            SELECT 
                SUM(Morning_Savings) AS Morning_Savings,
                SUM(Evening_Savings) AS Evening_Savings,
                SUM(Charging_Energy) AS Charging_Energy,
                SUM(Discharging_Energy) AS Discharging_Energy
            FROM EMS.IOE_Cost_Savings
            WHERE polledDate = %s;
        """, (value,))

        result = cursor.fetchone()
        cursor.close()
        db.close()

        if not result or all(v is None for v in result.values()):
            raise HTTPException(status_code=404, detail=f"No data found for {value}")

        return JSONResponse(content={
            "Selected_Date": value,
            "Morning_Savings": round(result["Morning_Savings"], 2) if result["Morning_Savings"] else 0,
            "Evening_Savings": round(result["Evening_Savings"], 2) if result["Evening_Savings"] else 0,
            "Charging_Energy": round(result["Charging_Energy"], 2) if result["Charging_Energy"] else 0,
            "Discharging_Energy": round(result["Discharging_Energy"], 2) if result["Discharging_Energy"] else 0
        })

    except mysql.connector.Error as e:
        raise HTTPException(status_code=500, detail=f"MySQL query failed: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")




@app.get('/Control/ExcesssREgraph')
def peak_demand_date(db: mysql.connector.connect = Depends(get_emsdb)):
    Consumption = []
    try:
        ems_db = get_awsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    emscur = ems_db.cursor()

    emscur.execute("select polledTime,wheeled,wheeled2,grid,wind,diesel,roofTop,ioe,thermal,peakDemand from EMS.tenMinData where polledTime >= curdate();")

    res = emscur.fetchall()

    OutLi = []

    for i in res:
        polledTime = str(i[0])[11:16]
        if i[1] != None:
            wheeled = i[1]
        else:
            wheeled = 0
        if i[2] != None:
            wheeled2 = i[2]
        else:
            wheeled2 = 0
        if i[3] != None:
            grid = i[3]
        else:
            grid = 0
        if i[4] != None:
            wind = i[4]
        else:
            wind = 0
        if i[5] != None:
            diesel = i[5]
        else:
            diesel = 0
        if i[6] != None:
            roofTop = i[6]
        else:
            roofTop = 0
        if i[7] != None:
            ioe = i[7]
        else:
            ioe = 0
        if i[8] != None:
            thermal = i[8]
        else:
            thermal = 0
        if i[9] != None:
            peak = i[9]
        else:
            peak = 0

        Consumption = grid+diesel+roofTop
        RE = wheeled+wheeled2+roofTop+wind

        Energy = Consumption - RE

        OutLi.append({'polledTime':polledTime,'consumption':Energy,
                      "battery":ioe,"Theraml":thermal,"peak":peak})
    return OutLi


@app.post('/Control/ExcesssREgraph/filtered')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_awsdb)):
    OutLi = []
    try:
        value = data.get('date')
        if value and isinstance(value, str):
            with db.cursor() as awscur:
                awscur.execute(f"select polledTime,wheeled,wheeled2,grid,wind,diesel,roofTop,ioe,thermal,peakDemand from EMS.tenMinData where polledTime >= '{value} 00:00:00' and polledTime <= '{value} 23:59:00';")

                res = awscur.fetchall()
                
                for i in res:
                    polledTime = str(i[0])[11:16]
                    if i[1] != None:
                        wheeled = i[1]
                    else:
                        wheeled = 0
                    if i[2] != None:
                        wheeled2 = i[2]
                    else:
                        wheeled2 = 0
                    if i[3] != None:
                        grid = i[3]
                    else:
                        grid = 0
                    if i[4] != None:
                        wind = i[4]
                    else:
                        wind = 0
                    if i[5] != None:
                        diesel = i[5]
                    else:
                        diesel = 0
                    if i[6] != None:
                        roofTop = i[6]
                    else:
                        roofTop = 0
                    if i[7] != None:
                        ioe = i[7]
                    else:
                        ioe = 0
                    if i[8] != None:
                        thermal = i[8]
                    else:
                        thermal = 0
                    if i[9] != None:
                        peak = i[9]
                    else:
                        peak = 0

                    Consumption = grid+diesel+roofTop
                    RE = wheeled+wheeled2+roofTop+wind

                    Energy = Consumption - RE

                    OutLi.append({'polledTime':polledTime,'consumption':Energy,
                                "battery":ioe,"Theraml":thermal,"peak":peak})

    except mysql.connector.Error as e:
        return JSONResponse(content={"error": ["MySQL connection error",e]}, status_code=500)
    
    return OutLi   

@app.get('/Consumption/HourlyData')
def peak_demand_date(db: mysql.connector.connect = Depends(get_emsdb)):
    Consumption = []
    try:
        ems_db = get_awsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    emscur = ems_db.cursor()

    emscur.execute("""SELECT 
                        chargingEnergy,
                        dischargingEnergy,
                        energyAvailable,
                        packsoc,
                        polledTime
                    FROM EMS.LTObatteryHourly
                    WHERE polledTime >= '{value} 00:00:00'
                    AND polledTime <  DATE_ADD('{value}', INTERVAL 1 DAY);
                    """)
    
    res = emscur.fetchall()

    for i in res:
        polledTime = str(i[0])[11:13]
        if i[1] != None:
            grid = i[1]
        else:
            grid = 0
        if i[2] != None:
            wheel = i[2]
        else:
            wheel = 0
        if i[3] != None:
            wheel2 = i[3]
        else:
            wheel2 = 0
        if i[4] != None:
            wind = i[4]
        else:
            wind = 0
        if i[5] != None:
            roof = i[5]
        else:
            roof = 0
        
        wheelSolar = wheel+wheel2
        RE = wheel2+wheel+wind+roof
        if polledTime == '06' or polledTime == '10' or polledTime == '22' or polledTime == '18':
            range = 5
        else:
            range = 0

        Consumption.append({'polledTime':polledTime,'range':range,'wheeledSolar':wheelSolar/1000,'RE':RE/1000,
                            'roof':roof/1000,'grid':grid/1000,'wind':wind/1000})
    
    return Consumption
        
@app.post('/Consumption/HourlyData/filtered')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_awsdb)):
    Consumption = []
    try:
        value = data.get('date')
        if value and isinstance(value, str):
            with db.cursor() as awscur:
                awscur.execute(f"""SELECT 
                                    polledTime,
                                    gridEnergy,
                                    windEnergy,
                                    wheeledinEnergy,
                                    wheeledinEnergy2,
                                    rooftopEnergy
                                FROM EMS.buildingConsumption
                                WHERE polledTime >= '{value} 00:00:00'
                                AND polledTime <  DATE_ADD('{value}', INTERVAL 1 DAY);
                                """)
                
                res = awscur.fetchall()

                for i in res:
                    polledTime = str(i[0])[11:13]
                    if i[1] != None:
                        grid = i[1]
                    else:
                        grid = 0
                    if i[2] != None:
                        wheel = i[2]
                    else:
                        wheel = 0
                    if i[3] != None:
                        wheel2 = i[3]
                    else:
                        wheel2 = 0
                    if i[4] != None:
                        wind = i[4]
                    else:
                        wind = 0
                    if i[5] != None:
                        roof = i[5]
                    else:
                        roof = 0
                    
                    wheelSolar = wheel+wheel2
                    RE = wheel2+wheel+wind+roof
                    if polledTime == '06' or polledTime == '10' or polledTime == '22' or polledTime == '18':
                        range = 5
                    else:
                        range = 0

                    Consumption.append({'polledTime':polledTime,'range':range,'wheeledSolar':wheelSolar/1000,'RE':RE/1000,
                            'roof':roof/1000,'grid':grid/1000,'wind':wind/1000})
                


    except mysql.connector.Error as e:
        return JSONResponse(content={"error": ["MySQL connection error",e]}, status_code=500)
    
    return Consumption    

@app.get('/SlotWise/Bill')
def peak_demand_date(db: mysql.connector.connect = Depends(get_emsdb)):
    slotWise = []
    try:
        ems_db = get_awsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    emscur = ems_db.cursor()

    emscur.execute("""SELECT 
                        MONTHNAME(polledDate) AS monthName,
                        c1Con, c2Con, c4Con, c5Con,
                        c1Wheeled, c2Wheeled, c4Wheeled, c5Wheeled,
                        c1Wind, c2Wind, c4Wind, c5Wind
                    FROM EMS.slotWiseCalculation
                    WHERE polledDate >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
                    AND polledDate <  DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH);
                    """)
    
    res = emscur.fetchall()

    if len(res) > 0:
        for i in res:
            month = i[0]
            c1con = i[1]/1000
            c2con = i[2]/1000
            c4con = i[3]/1000
            c5con = i[4]/1000
            c1wheel = i[5]/1000
            c2wheel = i[6]/1000
            c4wheel = i[7]/1000
            c5wheel = i[8]/1000
            c1wind = i[9]/1000
            c2wind = i[10]/1000
            c4wind = i[11]/1000
            c5wind = i[12]/1000

            slotWise.append({'month':month,'c1con':c1con,'c2con':c2con,'c4con':c4con,'c5con':c5con,
                             'c1wheel':c1wheel,'c2wheel':c2wheel,'c4wheel':c4wheel,'c5wheel':c5wheel,
                             'c1wind':c1wind,'c2wind':c2wind,'c4wind':c4wind,'c5wind':c5wind})

    return slotWise


@app.post('/SlotWise/Bill/filtered')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_awsdb)):
    slotWise = []
    try:
        value = data.get('month')
        if value and isinstance(value, str):
            year = int(value[0:4])
            mnth = int(value[5:7])
            print(year,mnth)
            with db.cursor() as awscur:
                awscur.execute(f"""SELECT 
                                        MONTH(polledDate) AS month,
                                        c1Consumption, c2Consumption, c4Consumption, c5Consumption,
                                        c1WheeledEnergy, c2WheeledEnergy, c4WheeledEnergy, c5WheeledEnergy,
                                        c1WindEnergy, c2WindEnergy, c4WindEnergy, c5WindEnergy
                                    FROM EMS.SlotWiseBillData
                                    WHERE polledDate >= MAKEDATE({year}, 1) + INTERVAL ({mnth}-1) MONTH
                                    AND polledDate <  MAKEDATE({year}, 1) + INTERVAL {mnth} MONTH;""")
                            
                res = awscur.fetchall()

                if len(res) > 0:
                    for i in res:
                        month = i[0]
                        c1con = i[1]/1000
                        c2con = i[2]/1000
                        c4con = i[3]/1000
                        c5con = i[4]/1000
                        c1wheel = i[5]/1000
                        c2wheel = i[6]/1000
                        c4wheel = i[7]/1000
                        c5wheel = i[8]/1000
                        c1wind = i[9]/1000
                        c2wind = i[10]/1000
                        c4wind = i[11]/1000
                        c5wind = i[12]/1000

                        slotWise.append({'month':month,'c1con':c1con,'c2con':c2con,'c4con':c4con,'c5con':c5con,
                                        'c1wheel':c1wheel,'c2wheel':c2wheel,'c4wheel':c4wheel,'c5wheel':c5wheel,
                                        'c1wind':c1wind,'c2wind':c2wind,'c4wind':c4wind,'c5wind':c5wind})

    except mysql.connector.Error as e:
        return JSONResponse(content={"error": ["MySQL connection error",e]}, status_code=500)
    
    return slotWise


@app.get('/SlotWise')
def peak_demand_date(db: mysql.connector.connect = Depends(get_emsdb)):
    slotWise = []
    try:
        ems_db = get_awsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    emscur = ems_db.cursor()

    emscur.execute("""SELECT 
                        MONTHNAME(polledDate) AS monthName,
                        c1Con, c2Con, c4Con, c5Con,
                        c1Wheeled, c2Wheeled, c4Wheeled, c5Wheeled,
                        c1WhlRem, c2WhlRem, c4WhlRem, c5WhlRem,
                        c1Wind, c2Wind, c4Wind, c5Wind,
                        c1WindRem, c2WindRem, c4WindRem, c5WindRem
                    FROM EMS.slotWiseCalculation
                    WHERE polledDate >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
                    AND polledDate <  DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH);
                    """)
    
    res = emscur.fetchall()

    if len(res) > 0:
        for i in res:
            month = i[0]
            c1con = i[1]
            c2con = i[2]
            c4con = i[3]
            c5con = i[4]
            c1wheel = i[5]
            c2wheel = i[6]
            c4wheel = i[7]
            c5wheel = i[8]
            c1whlR = i[9]
            c2whlR = i[10] 
            c4whlR = i[11]
            c5whlR = i[12]
            c1wind = i[13]
            c2wind = i[14]
            c4wind = i[15]
            c5wind = i[16]
            c1windR = i[17]
            c2windR = i[18]
            c4windR = i[19]
            c5windR = i[20]

            if c1windR < 0:
                c4con = c4con+abs(c1windR)
            if c2windR < 0:
                c4con = c4con+abs(c2windR)
            if c4windR < 0:
                c5con = c5con+abs(c4windR)

            if c1windR > 0:
                c1windR = 0
            if c2windR > 0:
                c2windR = 0
            if c4windR > 0:
                c4windR = 0
            if c5windR > 0:
                c5windR = 0

            slotWise.append({'c1con':c1con,'c2con':c2con,'c4con':c4con,'c5con':c5con,
                             'c1wheel':c1wheel,'c2wheel':c2wheel,'c4wheel':c4wheel,'c5wheel':c5wheel,
                             'c1wheelRem':c1whlR,'c2wheelRem':c2whlR,'c4wheelRem':c4whlR,'c5wheelRem':c5whlR,
                             'c1wind':c1wind,'c2wind':c2wind,'c4wind':c4wind,'c5wind':c5wind,
                             'c1windRem':c1windR,'c2windRem':c2windR,'c4windRem':c4windR,'c5windRem,':c5windR,
                             'month':month})

    return slotWise

@app.post('/SlotWise/filtered')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_awsdb)):
    slotWise = []
    try:
        value = data.get('month')
        if value and isinstance(value, str):
            year = int(value[0:4])
            mnth = int(value[5:])
            with db.cursor() as awscur:
                awscur.execute(f"""SELECT 
                                    MONTHNAME(polledDate) AS monthName,
                                    c1Con, c2Con, c4Con, c5Con,
                                    c1Wheeled, c2Wheeled, c4Wheeled, c5Wheeled,
                                    c1WhlRem, c2WhlRem, c4WhlRem, c5WhlRem,
                                    c1Wind, c2Wind, c4Wind, c5Wind,
                                    c1WindRem, c2WindRem, c4WindRem, c5WindRem
                                FROM EMS.slotWiseCalculation
                                WHERE polledDate >= MAKEDATE({year}, 1) + INTERVAL ({mnth}-1) MONTH
                                AND polledDate <  MAKEDATE({year}, 1) + INTERVAL {mnth} MONTH;
                                """)
                            
                res = awscur.fetchall()

                if len(res) > 0:
                    for i in res:
                        month = i[0]
                        c1con = i[1]
                        c2con = i[2]
                        c4con = i[3]
                        c5con = i[4]
                        c1wheel = i[5]
                        c2wheel = i[6]
                        c4wheel = i[7]
                        c5wheel = i[8]
                        c1whlR = i[9]
                        c2whlR = i[10] 
                        c4whlR = i[11]
                        c5whlR = i[12]
                        c1wind = i[13]
                        c2wind = i[14]
                        c4wind = i[15]
                        c5wind = i[16]
                        c1windR = i[17]
                        c2windR = i[18]
                        c4windR = i[19]
                        c5windR = i[20]

                        if c1windR < 0:
                            c4con = c4con+abs(c1windR)
                        if c2windR < 0:
                            c4con = c4con+abs(c2windR)
                        if c4windR < 0:
                            c5con = c5con+abs(c4windR)

                        if c1windR > 0:
                            c1windR = 0
                        if c2windR > 0:
                            c2windR = 0
                        if c4windR > 0:
                            c4windR = 0
                        if c5windR > 0:
                            c5windR = 0

                        slotWise.append({'c1con':c1con,'c2con':c2con,'c4con':c4con,'c5con':c5con,
                                        'c1wheel':c1wheel,'c2wheel':c2wheel,'c4wheel':c4wheel,'c5wheel':c5wheel,
                                        'c1wheelRem':c1whlR,'c2wheelRem':c2whlR,'c4wheelRem':c4whlR,'c5wheelRem':c5whlR,
                                        'c1wind':c1wind,'c2wind':c2wind,'c4wind':c4wind,'c5wind':c5wind,
                                        'c1windRem':c1windR,'c2windRem':c2windR,'c4windRem':c4windR,'c5windRem,':c5windR,
                                        'month':month})

    except mysql.connector.Error as e:
        return JSONResponse(content={"error": ["MySQL connection error",e]}, status_code=500)
    
    return slotWise

@app.get('/alert/logs')
def peak_demand_date(db: mysql.connector.connect = Depends(get_emsdb)):
    alerts = []
    try:
        ems_db = get_emsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    emscur = ems_db.cursor()

    emscur.execute("""SELECT recordId,alerttime,alert,limitvalue,systemName,severity,action 
                        FROM EMS.alertLogs order by alerttime desc;""")
    
    res = emscur.fetchall()

    for i in res:
        dt = str(i[1])
        dated = dt[8:10]+'/'+dt[5:7]+'/'+dt[0:4]
        timer = dt[11:]
        alerts.append({'id':i[0],'alerttimereceived':[dated,timer],'alert':i[2],
                       'limitvalue':i[3],'systemName':i[4],'severity':i[5],'action':i[6]})
    
    return alerts


@app.get('/wind/dayEnergyPlot')
def peak_demand_date(db: mysql.connector.connect = Depends(get_meterdb)):
    windEnergy = []

    try:
        aws_db = get_awsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    awscur = aws_db.cursor()
    
    awscur.execute("SELECT polledDate,Energy FROM EMS.windDayWise order by polledDate desc limit 7;")

    res = awscur.fetchall()

    for i in res:
        windEnergy.append({"polledDate":i[0],"Energy":i[1]})

    return windEnergy


@app.post('/wind/dayEnergyPlot/Filtered')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_awsdb)):
    windEnergy = []
    try:
        value1 = data.get('startdate')
        value2 = data.get('enddate')
        if value1 and value2:
            with db.cursor() as awscur:
                awscur.execute(f"""SELECT 
                                        polledDate,
                                        Energy
                                    FROM EMS.windDayWise
                                    WHERE polledDate >= '{value1}'
                                    AND polledDate <  DATE_ADD('{value2}', INTERVAL 1 DAY);""")
                res =  awscur.fetchall()

                for i in res:
                    windEnergy.append({"polledDate":i[0],"Energy":i[1]})
        elif value1:
            with db.cursor() as awscur:
                value2 = str(datetime.now())[0:10]
                awscur.execute(f"""SELECT 
                                        polledDate,
                                        Energy
                                    FROM EMS.windDayWise
                                    WHERE polledDate >= '{value1}'
                                    AND polledDate < CURDATE() + INTERVAL 1 DAY;""")
                res =  awscur.fetchall()

                for i in res:
                    windEnergy.append({"polledDate":i[0],"Energy":i[1]})
    except mysql.connector.Error as e:
        return JSONResponse(content={"error": ["MySQL connection error",e]}, status_code=500)

    return windEnergy


@app.get('/wind/monthEnergyPlot')
def peak_demand_date(db: mysql.connector.connect = Depends(get_meterdb)):
    windEnergy = []

    try:
        aws_db = get_awsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    awscur = aws_db.cursor()

    awscur.execute("SELECT * FROM (SELECT YEAR(polledDate) AS yr, MONTH(polledDate) AS mn, Energy FROM EMS.windMonthWise ORDER BY yr DESC, mn DESC LIMIT 6) t ORDER BY yr ASC, mn ASC;")

    res =  awscur.fetchall()
    for i in res:
        month = str(i[0])+"-"+str(i[1])+"-01"
        windEnergy.append({'Month':month,"Energy":i[2]})

    return windEnergy

@app.post('/wind/monthEnergyPlot/Filtered')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_awsdb)):
    windEnergy = []
    try:
        value1 = data.get('startdate')
        value2 = data.get('enddate')
        if value1 and value2:
            with db.cursor() as awscur:
                awscur.execute(f"""select year(polledDate),month(polledDate),Energy from EMS.windMonthWise
                    where polledDate BETWEEN '{value1}' AND '{value2}';""")
                res =  awscur.fetchall()
                for i in res:
                    month = str(i[0])+"-"+str(i[1])+"-01"
                    windEnergy.append({'Month':month,"Energy":i[2]})
        elif value1:
            with db.cursor() as awscur:
                value2 = str(datetime.now())[0:10]
                awscur.execute(f"""select year(polledDate),month(polledDate),Energy from EMS.windMonthWise
                    where polledDate BETWEEN '{value1}' AND '{value2}';""")
                res =  awscur.fetchall()
                for i in res:
                    month = str(i[0])+"-"+str(i[1])+"-01"
                    windEnergy.append({'Month':month,"Energy":i[2]})
    except mysql.connector.Error as e:
        return JSONResponse(content={"error": ["MySQL connection error",e]}, status_code=500)

    return windEnergy

@app.get('/wind/monthTotalEnergy')
def peak_demand_date(db: mysql.connector.connect = Depends(get_meterdb)):
    windEnergy = []

    try:
        aws_db = get_awsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    awscur = aws_db.cursor()

    awscur.execute("""SELECT 
                        polledDate,
                        Energy
                    FROM EMS.windMonthWise
                    WHERE polledDate >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
                    AND polledDate <  DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH);
                    """)

    res = awscur.fetchall()

    for i in res:
        windEnergy.append({"windEnergy":i[1]})
    
    return windEnergy

@app.get('/wind/totalEnergy')
def peak_demand_date(db: mysql.connector.connect = Depends(get_meterdb)):
    windEnergy = []
    energy = 0
    try:
        aws_db = get_awsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    awscur = aws_db.cursor()

    awscur.execute("""SELECT polledTime, Energy
                        FROM EMS.windEnergyHourly
                        WHERE polledTime >= CURDATE()
                        ORDER BY polledTime;
                        """)

    res = awscur.fetchall()

    for i in res:
        if i[1] != None:
            energy += i[1]
    if energy != 0:
        plf = round((energy/(24*3000))*100,2)
    windEnergy.append({"Energy":energy,"PLF":plf})

    return windEnergy


@app.post('/wind/totalEnergy/Filtered')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_awsdb)):
    windEnergy = []
    energy = 0
    try:
        value = data.get('date')
        if value and isinstance(value, str):
            with db.cursor() as awscur:
                awscur.execute(f"""SELECT polledTime, Energy
                                    FROM EMS.windEnergyHourly
                                    WHERE polledTime >= '{value} 00:00:00'
                                    AND polledTime <  DATE_ADD('{value} 00:00:00', INTERVAL 1 DAY)
                                    ORDER BY polledTime;
                                    """)

                res = awscur.fetchall()

                for i in res:
                    if i[1] != None:
                        energy += i[1]
                if energy != 0:
                    plf = (energy/(24*3000))*100    
                windEnergy.append({"Energy":energy,"PLF":plf})
        
    except mysql.connector.Error as e:
        return JSONResponse(content={"error": ["MySQL connection error",e]}, status_code=500)

    return windEnergy
    
@app.post('/Analysis/TopElectricClients/search')
async def peak_demand_date(
    request: Request,
    db: mysql.connector.connect = Depends(get_awsdb)
):
    electricalEnergyData = []

    try:
        data = await request.json()
        value = data.get('date')           # YYYY-MM-DD or None
        tenantNames = data.get('tenantNames', [])

        if not tenantNames:
            raise HTTPException(status_code=400, detail="tenantNames required")

        placeholders = ",".join(["%s"] * len(tenantNames))

        # ✅ Date provided
        if value and isinstance(value, str):
            query = f"""
                SELECT
                    TIME(polledtime),
                    tenantname,
                    IFNULL(ROUND(energy,2), 0)
                FROM EMS.ToptenElectricalclients
                WHERE polledtime >= %s
                  AND polledtime < DATE_ADD(%s, INTERVAL 1 DAY)
                  AND tenantname IN ({placeholders})
                ORDER BY polledtime;
            """
            params = [value, value] + tenantNames

        # ✅ Date not provided → today
        else:
            query = f"""
                SELECT
                    TIME(polledtime),
                    tenantname,
                    IFNULL(ROUND(energy,2), 0)
                FROM EMS.ToptenElectricalclients
                WHERE polledtime >= CURDATE()
                  AND tenantname IN ({placeholders})
                ORDER BY polledtime;
            """
            params = tenantNames

        with db.cursor() as ems_cur:
            ems_cur.execute(query, params)
            res = ems_cur.fetchall()

        for polledTime, tenant, energy in res:
            electricalEnergyData.append({
                "polledTime": str(polledTime),
                "tenantname": tenant,
                "client_energy": energy
            })

        return electricalEnergyData

    except mysql.connector.Error as e:
        print(e)
        return JSONResponse(
            content={"error": "MySQL connection error"},
            status_code=500
        )

    except Exception as e:
        print(e)
        return JSONResponse(
            content={"error": str(e)},
            status_code=500
        )

@app.post('/Analysis/TopCoolingClients/search')
async def peak_demand_date(
    request: Request,
    db: mysql.connector.connect = Depends(get_awsdb)
):
    coolingEnergyData = []

    try:
        data = await request.json()
        value = data.get('date')
        tenantNames = data.get('tenantNames')

        print("Incoming payload:", data)

        # ✅ Guard against empty / invalid tenant list
        if not tenantNames or not isinstance(tenantNames, list):
            raise HTTPException(
                status_code=400,
                detail="tenantNames must be a non-empty list"
            )

        placeholders = ",".join(["%s"] * len(tenantNames))

        # ✅ Normalize empty date
        if value == "":
            value = None

        # ✅ Date provided
        if value:
            query = f"""
                SELECT
                    TIME(polledtime),
                    tenantname,
                    IFNULL(ROUND(energy,2), 0)
                FROM EMS.ToptenCoolingclients
                WHERE polledtime >= %s
                  AND polledtime < DATE_ADD(%s, INTERVAL 1 DAY)
                  AND tenantname IN ({placeholders})
                ORDER BY polledtime;
            """
            params = [value, value] + tenantNames

        # ✅ Date not provided → today
        else:
            query = f"""
                SELECT
                    TIME(polledtime),
                    tenantname,
                    IFNULL(ROUND(energy,2), 0)
                FROM EMS.ToptenCoolingclients
                WHERE polledtime >= CURDATE()
                  AND tenantname IN ({placeholders})
                ORDER BY polledtime;
            """
            params = tenantNames

        print("Executing query:", query)
        print("Params:", params)

        with db.cursor() as ems_cur:
            ems_cur.execute(query, params)
            res = ems_cur.fetchall()

        for polledTime, tenant, energy in res:
            coolingEnergyData.append({
                "polledTime": str(polledTime),
                "tenantname": tenant,
                "client_energy": energy
            })

        return coolingEnergyData

    except mysql.connector.Error as e:
        print("MySQL ERROR:", e)
        return JSONResponse(
            content={"error": str(e)},
            status_code=500
        )

    except Exception as e:
        print("GENERAL ERROR:", e)
        return JSONResponse(
            content={"error": str(e)},
            status_code=500
        )
       

@app.get('/ioe/CurrentVoltage')
def peak_demand_date(db: mysql.connector.connect = Depends(get_awsdb)):
    batteryList = []
    try:
        processed_db = get_awsdb()
        ems_cur = processed_db.cursor()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    ems_cur.execute("""SELECT polledTime,st1_current,st2_current,st3_current,st4_current,st5_current,
        st1_voltage,st2_voltage,st3_voltage,st4_voltage,st5_voltage,sum_of_current,avg_of_voltage FROM EMS.ioecurvol where polledTime >= curdate();""")
    
    res = ems_cur.fetchall()

    for i in res:
        polledTime = str(i[0])[11:16]
        batteryList.append({"polledTime":polledTime,"current1":i[1],"current2":i[2],"current3":i[3],"current4":i[4],"current5":i[5],
                            "voltage1":i[6],"voltage2":i[7],"voltage3":i[8],"voltage4":i[9],"voltage5":i[10],"totalCurrent":i[11],"avgVoltage":i[12]})
        
    return batteryList


@app.post('/ioe/CurrentVoltage/Filtered')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_awsdb)):
    batteryList = []
    try:
        value = data.get('date')
        if value and isinstance(value, str):
            with db.cursor() as ems_cur:
                ems_cur.execute(f"""SELECT polledTime,st1_current,st2_current,st3_current,st4_current,st5_current,
                    st1_voltage,st2_voltage,st3_voltage,st4_voltage,st5_voltage,sum_of_current,avg_of_voltage FROM EMS.ioecurvol where polledTime >= '{value} 00:00:00' and polledTime <= '{value} 23:59:00';""")
                
                res = ems_cur.fetchall()

                for i in res:
                    polledTime = str(i[0])[11:16]
                    batteryList.append({"polledTime":polledTime,"current1":i[1],"current2":i[2],"current3":i[3],"current4":i[4],"current5":i[5],
                                        "voltage1":i[6],"voltage2":i[7],"voltage3":i[8],"voltage4":i[9],"voltage5":i[10],"totalCurrent":i[11],"avgVoltage":i[12]})
            return batteryList
    except mysql.connector.Error as e:
        print(e)
        return JSONResponse(content={"error": "MySQL connection error"}, status_code=500)


@app.get('/battery/Operations')
def peak_demand_date(db: mysql.connector.connect = Depends(get_awsdb)):
    batteryOperationData=[]
    try:
        processed_db = get_awsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
   
    ems_cur = processed_db.cursor()
    ems_cur.execute("SELECT polledtime,peak_Demand,LTO_Power,IOE_Battery_Power,Demand_without_Peakshaving FROM EMS.Batteryoperation where polledtime >= curdate();")   
    res = ems_cur.fetchall()

    for i in res:
        polledTime = str(i[0])[11:19]
        if(i[1]==None):
            peak_Demand=0
        else:
            peak_Demand=round(i[1],2)
        if(i[2]==None):
            LTO_Power=0
        else:
            LTO_Power=round(i[2],2)
        if(i[3]==None):
            IOE_Battery_Power=0
        else:
            IOE_Battery_Power=round(i[3],2)
        if(i[4]==None):
            Demand_without_Peakshaving=0
        else:
            Demand_without_Peakshaving=round(i[4],2)
        batteryOperationData.append({'polledTime':polledTime,"peak_Demand":peak_Demand,"LTO_Power":LTO_Power,"IOE_Battery_Power":IOE_Battery_Power,"Demand_without_Peakshaving":Demand_without_Peakshaving})
    
    return batteryOperationData


@app.post('/battery/Operations/Filtered')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_awsdb)):
    batteryOperationData=[]
    try:
        value = data.get('date')
        if value and isinstance(value, str):
            with db.cursor() as bmscur:
                bmscur.execute(f"""SELECT polledtime,
                                        peak_Demand,
                                        LTO_Power,
                                        IOE_Battery_Power,
                                        Demand_without_Peakshaving
                                    FROM EMS.Batteryoperation
                                    WHERE polledtime >= '{value} 00:00:00'
                                    AND polledtime <=  '{value} 23:59:00';""")
                res = bmscur.fetchall()

                for i in res:
                    polledTime = str(i[0])[11:19]
                    if(i[1]==None):
                        peak_Demand=0
                    else:
                        peak_Demand=round(i[1],2)
                    if(i[2]==None):
                        LTO_Power=0
                    else:
                        LTO_Power=round(i[2],2)
                    if(i[3]==None):
                        IOE_Battery_Power=0
                    else:
                        IOE_Battery_Power=round(i[3],2)
                    if(i[4]==None):
                        Demand_without_Peakshaving=0
                    else:
                        Demand_without_Peakshaving=round(i[4],2)
        
                    batteryOperationData.append({'polledTime':polledTime,"peak_Demand":peak_Demand,"LTO_Power":LTO_Power,"IOE_Battery_Power":IOE_Battery_Power,"Demand_without_Peakshaving":Demand_without_Peakshaving})   
                return batteryOperationData
    except mysql.connector.Error as e:
        print(e)
        return JSONResponse(content={"error": "MySQL connection error"}, status_code=500)


@app.get('/battery/Usage')
def peak_demand_date(db: mysql.connector.connect = Depends(get_awsdb)):
    batteryUsageData=[]
    try:
        processed_db = get_awsdb()
        emsdb = get_emsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
   
    aws_cur = processed_db.cursor()

    aws_cur.execute("SELECT LTO_Average_discharge_power,LTO_Duration FROM EMS.BatterysUsage where date(polledtime)=curdate() order by  polledtime desc limit 1;")
    res1 = aws_cur.fetchall()

    ems_cur = emsdb.cursor()
    ems_cur.execute("""SELECT sum(TIMESTAMPDIFF(Minute, dischargeON, dischargeOFF)) as Minutes, sum(Energy) as Energy 
            FROM EMS.ioePeakDchg where dischargeON >= curdate();""")
        
    res2 = ems_cur.fetchall()

    ltoTime = 0
    LTO_Average_discharge_power = 0
    ioeTime = 0
    IoE_Average_discharge_power = 0

    for i in res1:      
        if i[0]!=None:
            LTO_Average_discharge_power=round(i[0],2)
            ltoTime = i[1]    
    
    for i in res2:
        if i[1] != None:
            IoE_Average_discharge_power = abs(i[1])
            ioeTime = i[0]

    batteryUsageData.append({'LTO_Average_discharge_power':LTO_Average_discharge_power,"IoE_Average_discharge_power":IoE_Average_discharge_power,
                                 'IOEDuration':ioeTime,'LTODuration':ltoTime})
    
    return batteryUsageData

@app.post('/battery/Usage/Filtered')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_awsdb)):
    batteryUsageData=[]
    try:
        value = data.get('date')

        if value and isinstance(value, str):
            with db.cursor() as bmscur:
                bmscur.execute(f"SELECT LTO_Average_discharge_power,LTO_Duration FROM EMS.BatterysUsage where date(polledtime)= '{value}' order by  polledtime desc limit 1;")
                res1 = bmscur.fetchall()

                emsdb = get_emsdb()
                ems_cur = emsdb.cursor()
                ems_cur.execute(f"""SELECT sum(TIMESTAMPDIFF(Minute, dischargeON, dischargeOFF)) as Minutes, sum(Energy) as Energy 
                        FROM EMS.ioePeakDchg where dischargeON >= '{value} 00:00:00' and dischargeON <= '{value} 23:59:00';""")
                    
                res2 = ems_cur.fetchall()

                ltoTime = 0
                LTO_Average_discharge_power = 0
                ioeTime = 0
                IoE_Average_discharge_power = 0

                for i in res1:      
                    if i[0] !=None :
                        LTO_Average_discharge_power=round(i[0],2)
                        ltoTime = i[1]    
                
                for i in res2:
                    if i[1] != None:
                        IoE_Average_discharge_power = abs(i[1])
                        ioeTime = i[0]

                batteryUsageData.append({'LTO_Average_discharge_power':LTO_Average_discharge_power,"IoE_Average_discharge_power":IoE_Average_discharge_power,
                                            'IOEDuration':ioeTime,'LTODuration':ltoTime})
        return batteryUsageData
    except mysql.connector.Error as e:
        print(e)
        return JSONResponse(content={"error": "MySQL connection error"}, status_code=500)
    

@app.get('/Analysis/TopElectricClients')
def topCoolingClients(db: mysql.connector.connect = Depends(get_meterdb)):
    ClientLi = []
    try:
        aws_db = get_awsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    awscur = aws_db.cursor()
    
    awscur.execute("""SELECT tenantname,sum(Energy) AS TotalEnergy FROM EMS.Clientshourlysum 
                      where polledTime >= curdate() GROUP BY tenantname 
                      order by TotalEnergy desc limit 10; """)
    
    limitres = awscur.fetchall()

    ClientList = {}

    for i in limitres:
        awscur.execute(f"""select polledTime,tenantname,Energy FROM EMS.Clientshourlysum  
                           where polledTime >= curdate() and tenantname = '{i[0]}';""")
        
        res = awscur.fetchall()

        for j in res:
            if j[1] in ClientList.keys():
                polledTime = str(j[0])[11:16]
                ClientList[j[1]].append({'polledTime':polledTime,'Energy':j[2]})
            else:
                polledTime = str(j[0])[11:16]
                ClientList[j[1]] = [{'polledTime':polledTime,'Energy':j[2]}]

    finalRes = process_energy_data(ClientList)

    ClientLi = [finalRes]

    return ClientLi

@app.post('/Analysis/TopElectricClients/Filtered')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_awsdb)):
    ClientLi = []

    try:
        value = data.get('date')

        if value and isinstance(value, str):
            with db.cursor() as awscur:
                awscur.execute(f"""SELECT tenantname,SUM(Energy) AS TotalEnergy FROM EMS.Clientshourlysum 
                      where polledTime >= '{value} 00:00:00' and polledTime <= '{value} 23:59:00' GROUP BY tenantname
                      order by TotalEnergy desc limit 10;""")
    
                limitres = awscur.fetchall()

                ClientList = {}

                for i in limitres:
                    awscur.execute(f"""select polledTime,tenantname,Energy FROM EMS.Clientshourlysum  
                                    where polledTime >= '{value} 00:00:00' and polledTime <= '{value} 23:59:00' and tenantname = '{i[0]}';""")
                    
                    res = awscur.fetchall()

                    for i in res:
                        if i[1] in ClientList.keys():
                            polledTime = str(i[0])[11:16]
                            ClientList[i[1]].append({'polledTime':polledTime,'Energy':i[2]})
                        else:
                            polledTime = str(i[0])[11:16]
                            ClientList[i[1]] = [{'polledTime':polledTime,'Energy':i[2]}]

                finalRes = process_energy_data(ClientList)

                ClientLi = [finalRes]
                
    except mysql.connector.Error as e:
        return JSONResponse(content={"error": ["MySQL connection error",e]}, status_code=500)

    return ClientLi

@app.get('/Analysis/TopCoolingClients')
def topCoolingClients(db: mysql.connector.connect = Depends(get_meterdb)):
    ClientLi = []
    try:
        aws_db = get_awsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    awscur = aws_db.cursor()
    
    awscur.execute("""SELECT tenantname,SUM(Energy) AS TotalEnergy FROM EMS.Clientscoolinghourlysum 
                      where polledTime >= curdate() GROUP BY tenantname
                      order by TotalEnergy desc limit 10;""")
    
    limitres = awscur.fetchall()

    ClientList = {}

    for i in limitres:
        awscur.execute(f"""select polledTime,tenantname,Energy FROM EMS.Clientscoolinghourlysum  
                           where polledTime >= curdate() and tenantname = '{i[0]}';""")
        
        res = awscur.fetchall()

        for j in res:
            if j[1] in ClientList.keys():
                polledTime = str(j[0])[11:16]
                ClientList[j[1]].append({'polledTime':polledTime,'Energy':j[2]})
            else:
                polledTime = str(j[0])[11:16]
                ClientList[j[1]] = [{'polledTime':polledTime,'Energy':j[2]}]

    finalRes = process_energy_data(ClientList)

    ClientLi = [finalRes]

    return ClientLi
   
@app.post('/Analysis/TopCoolingClients/Filtered')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_awsdb)):
    ClientLi = []

    try:
        value = data.get('date')

        if value and isinstance(value, str):
            with db.cursor() as awscur:
                awscur.execute(f"""SELECT tenantname,SUM(Energy) AS TotalEnergy FROM EMS.Clientscoolinghourlysum 
                      where polledTime >= '{value} 00:00:00' and polledTime <= '{value} 23:59:00' GROUP BY tenantname
                      order by TotalEnergy desc limit 10;""")
    
                limitres = awscur.fetchall()

                ClientList = {}

                for i in limitres:
                    awscur.execute(f"""select polledTime,tenantname,Energy FROM EMS.Clientscoolinghourlysum  
                                    where polledTime >= '{value} 00:00:00' and polledTime <= '{value} 23:59:00' and tenantname = '{i[0]}';""")
                    
                    res = awscur.fetchall()

                    for i in res:
                        if i[1] in ClientList.keys():
                            polledTime = str(i[0])[11:16]
                            ClientList[i[1]].append({'polledTime':polledTime,'Energy':i[2]})
                        else:
                            polledTime = str(i[0])[11:16]
                            ClientList[i[1]] = [{'polledTime':polledTime,'Energy':i[2]}]

                finalRes = process_energy_data(ClientList)

                ClientLi = [finalRes]
                
    except mysql.connector.Error as e:
        return JSONResponse(content={"error": ["MySQL connection error",e]}, status_code=500)

    return ClientLi

@app.get('/Analysis/MaxPeak')
def maxPeakJump(db: mysql.connector.connect = Depends(get_meterdb)):
    max_peak = []

    try:
        aws_db = get_awsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    awscur = aws_db.cursor()

    awscur.execute("select peakJump,peakTime from EMS.PeakMaxJump where polledDate = curdate();")

    res = awscur.fetchall()

    for i in res:
        max_peak.append({"maxJump":i[0],'peakTime':i[1]})
    
    return max_peak

@app.post('/Analysis/MaxPeak/Filtered')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_awsdb)):
    max_peak = []

    try:
        value = data.get('date')

        if value and isinstance(value, str):
            with db.cursor() as awscur:
                awscur.execute(f"select peakJump,peakTime from EMS.PeakMaxJump where polledDate = '{value}';")

                res = awscur.fetchall()

                for i in res:
                    max_peak.append({'maxJump':i[0],'peakTime':i[1]})

    except mysql.connector.Error as e:
        return JSONResponse(content={"error": ["MySQL connection error",e]}, status_code=500)

    return max_peak


@app.get('/Analysis/InverterHourlyph2')
def peak_demand_date(db: mysql.connector.connect = Depends(get_meterdb)):
    inverterlis = []

    try:
        aws_db = get_awsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    awscur = aws_db.cursor()

    awscur.execute("""SELECT polledTime, inverter9, inverter10, inverter11, inverter12, inverter13, inverter14
                        FROM EMS.inverterHourlyph2
                        WHERE polledTime >= CURDATE()
                        ORDER BY polledTime;""")

    inverres = awscur.fetchall()

    for i in inverres:
        polledTime = str(i[0])[11:16]
        inverterlis.append({'polledTime':polledTime,'inverter9':i[1],'inverter10':i[2],'inverter11':i[3],
                            'inverter12':i[4],'inverter13':i[5],'inverter14':i[6]})
    
    return inverterlis


@app.post('/Analysis/InverterHourlyph2/Filtered')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_awsdb)):
    inverterlis = []

    try:
        value = data.get('date')

        if value and isinstance(value, str):
            with db.cursor() as awscur:
                awscur.execute(f"SELECT polledTime,inverter9,inverter10,inverter11,inverter12,inverter13,inverter14 FROM EMS.inverterHourlyph2 where polledTime >= '{value} 00:00:00' and polledTime <= '{value} 23:59:00';")

                inverres = awscur.fetchall()

                for i in inverres:
                    polledTime = str(i[0])[11:16]
                    inverterlis.append({'polledTime':polledTime,'inverter9':i[1],'inverter10':i[2],'inverter11':i[3],
                                        'inverter12':i[4],'inverter13':i[5],'inverter14':i[6]})
    
    except mysql.connector.Error as e:
        return JSONResponse(content={"error": ["MySQL connection error",e]}, status_code=500)

    return inverterlis


@app.get('/Analysis/InverterHourly')
def peak_demand_date(db: mysql.connector.connect = Depends(get_meterdb)):
    inverterlis = []

    try:
        aws_db = get_awsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    awscur = aws_db.cursor()

    awscur.execute("SELECT polledTime,inverter1,inverter2,inverter3,inverter4,inverter5,inverter6,inverter7,inverter8 FROM EMS.inverterPowerHourly where polledTime >= curdate();")

    inverres = awscur.fetchall()

    for i in inverres:
        polledTime = str(i[0])[11:16]
        inverterlis.append({'polledTime':polledTime,'inverter1':i[1],'inverter2':i[2],'inverter3':i[3],'inverter4':i[4],
                            'inverter5':i[5],'inverter6':i[6],'inverter7':i[7],'inverter8':i[8]})
    
    return inverterlis

@app.post('/Analysis/InverterHourly/Filtered')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_awsdb)):
    inverterlis = []

    try:
        value = data.get('date')

        if value and isinstance(value, str):
            with db.cursor() as awscur:
                awscur.execute(f"SELECT polledTime,inverter1,inverter2,inverter3,inverter4,inverter5,inverter6,inverter7,inverter8 FROM EMS.inverterPowerHourly where polledTime >= '{value} 00:00:00' and polledTime <= '{value} 23:59:00';")

                inverres = awscur.fetchall()

                for i in inverres:
                    polledTime = str(i[0])[11:16]
                    inverterlis.append({'polledTime':polledTime,'inverter1':i[1],'inverter2':i[2],'inverter3':i[3],'inverter4':i[4],
                                        'inverter5':i[5],'inverter6':i[6],'inverter7':i[7],'inverter8':i[8]})
    
    except mysql.connector.Error as e:
        return JSONResponse(content={"error": ["MySQL connection error",e]}, status_code=500)

    return inverterlis


@app.get('/Analysis/Wheeledin2')
def peak_demand_date(db: mysql.connector.connect = Depends(get_meterdb)):
    wheellis = []

    try:
        aws_db = get_awsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    awscur = aws_db.cursor()

    awscur.execute("SELECT polledTime,Energy,irradiation,expectedEnergy FROM EMS.WheeledHourlyph2 where polledTime >= curdate();")

    wheelres = awscur.fetchall()

    for i in wheelres:
        polledTime = str(i[0])[11:16]
        wheellis.append({'polledTime':polledTime,'Energy':i[1],'Irradiation':i[2],'expextedEnergy':i[3]})
    
    return wheellis


@app.post('/Analysis/Wheeledin2/Filtered')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_awsdb)):
    wheellis = []

    try:
        value = data.get('date')

        if value and isinstance(value, str):
            with db.cursor() as awscur:
                awscur.execute(f"SELECT polledTime,Energy,irradiation,expectedEnergy FROM EMS.WheeledHourlyph2 where polledTime >= '{value} 00:00:00' and polledTime <= '{value} 23:59:00';")

                wheelres = awscur.fetchall()

                for i in wheelres:
                    polledTime = str(i[0])[11:16]
                    wheellis.append({'polledTime':polledTime,'Energy':i[1],'Irradiation':i[2],'expextedEnergy':i[3]})
        
    except mysql.connector.Error as e:
        return JSONResponse(content={"error": ["MySQL connection error",e]}, status_code=500)

    return wheellis


@app.get('/Analysis/Wheeledin')
def peak_demand_date(db: mysql.connector.connect = Depends(get_meterdb)):
    wheellis = []

    try:
        aws_db = get_awsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    awscur = aws_db.cursor()

    awscur.execute("SELECT polledTime,Energy,irradiation,expectedEnergy FROM EMS.WheeledHourly where polledTime >= curdate();")

    wheelres = awscur.fetchall()

    for i in wheelres:
        polledTime = str(i[0])[11:16]
        wheellis.append({'polledTime':polledTime,'Energy':i[1],'Irradiation':i[2],'expextedEnergy':i[3]})
    
    return wheellis


@app.post('/Analysis/Wheeledin/Filtered')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_awsdb)):
    wheellis = []

    try:
        value = data.get('date')

        if value and isinstance(value, str):
            with db.cursor() as awscur:
                awscur.execute("SELECT polledTime,Energy,irradiation,expectedEnergy FROM EMS.WheeledHourly where polledTime >= curdate();")

                wheelres = awscur.fetchall()

                for i in wheelres:
                    polledTime = str(i[0])[11:16]
                    wheellis.append({'polledTime':polledTime,'Energy':i[1],'Irradiation':i[2],'expextedEnergy':i[3]})
        
    except mysql.connector.Error as e:
        return JSONResponse(content={"error": ["MySQL connection error",e]}, status_code=500)

    return wheellis

    
@app.get('/peakDemand/Analysis/Jump')
def peak_demand_date(db: mysql.connector.connect = Depends(get_meterdb)):
    peaklis = []

    try:
        aws_db = get_awsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    awscur = aws_db.cursor()

    awscur.execute("select j0to50,j50to100,j100to150,j150to200,j200to250,j250 from EMS.peakJump where polledDate = curdate();")

    peakres = awscur.fetchall()

    for i in peakres:
        if i[0] != None:
            j0 = i[0]
        else:
            j0 = 0
        if i[1] != None:
            j50 = i[1]
        else:
            j50 = 0
        if i[2] != None:
            j100 = i[2]
        else:
            j100 = 0
        if i[3] != None:
            j150 = i[3]
        else:
            j150 = 0
        if i[4] != None:
            j200 = i[4]
        else:
            j200 = 0
        if i[5] != None:
            j250 = i[5]
        else:
            j250 = 0

        total = j0+j50+j100+j150+j200+j250

        print(total)

        j0pr = round((j0/total)*100,2)
        j50pr = round((j50/total)*100,2)
        j100pr = round((j100/total)*100,2)
        j150pr = round((j150/total)*100,2)
        j200pr = round((j200/total)*100,2)
        j250pr = round((j250/total)*100,2)


        peaklis.append({'j0to50':j0,'j50to100':j50,'j100to150':j100,'j150to200':j150,'j200to250':j200,'j250':j250,
                        'j0to50pr':j0pr,'j50to100pr':j50pr,'j100toj150pr':j100pr,'j150toj200pr':j150pr,
                        'j200to250pr':j200pr,'j250pr':j250pr})

    return peaklis


@app.post('/peakDemand/Analysis/Jump/Filtered')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_awsdb)):
    peaklis = []

    try:
        value = data.get('date')

        if value and isinstance(value, str):
            with db.cursor() as awscur:

                awscur.execute(f"select j0to50,j50to100,j100to150,j150to200,j200to250,j250 from EMS.peakJump where polledDate = '{value}';")

                peakres = awscur.fetchall()

                for i in peakres:
                    if i[0] != None:
                        j0 = i[0]
                    else:
                        j0 = 0
                    if i[1] != None:
                        j50 = i[1]
                    else:
                        j50 = 0
                    if i[2] != None:
                        j100 = i[2]
                    else:
                        j100 = 0
                    if i[3] != None:
                        j150 = i[3]
                    else:
                        j150 = 0
                    if i[4] != None:
                        j200 = i[4]
                    else:
                        j200 = 0
                    if i[5] != None:
                        j250 = i[5]
                    else:
                        j250 = 0

                    total = j0+j50+j100+j150+j200+j250

                    print(total)

                    j0pr = round((j0/total)*100,2)
                    j50pr = round((j50/total)*100,2)
                    j100pr = round((j100/total)*100,2)
                    j150pr = round((j150/total)*100,2)
                    j200pr = round((j200/total)*100,2)
                    j250pr = round((j250/total)*100,2)


                    peaklis.append({'j0to50':j0,'j50to100':j50,'j100to150':j100,'j150to200':j150,'j200to250':j200,'j250':j250,
                                    'j0to50pr':j0pr,'j50to100pr':j50pr,'j100toj150pr':j100pr,'j150toj200pr':j150pr,
                                    'j200to250pr':j200pr,'j250pr':j250pr})

    except mysql.connector.Error as e:
        return JSONResponse(content={"error": ["MySQL connection error",e]}, status_code=500)

    return peaklis

@app.get('/peakDemand/Analysis/Energy')
def peak_demand_date(db: mysql.connector.connect = Depends(get_meterdb)):
    peaklis = []

    try:
        aws_db = get_awsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    awscur = aws_db.cursor()

    awscur.execute("SELECT maxAvgPeak FROM EMS.peakShavingLogic where polledTime >= curdate() order by polledTime desc limit 1;")

    res = awscur.fetchall()
    print(res)

    if len(res) > 0:
        if res[0][0] != None:
            max_res = res[0][0]
            if max_res > 4500:
                max_res = 4500
        else:
            max_res = None
    else:
        max_res = None

    if max_res != None:
        # print(max_res)
        max_res = round(max_res)

        awscur.execute(f"SELECT round(sum(mvp1+mvp2+mvp3+mvp4),2) FROM EMS.peakVsKVA where peakDemand > {max_res} and polledTime >= curdate();")

        energyRes = awscur.fetchall()

        if energyRes[0][0] != None:
            Energy = energyRes[0][0]
        else:
            Energy = 0

        peaklis.append({'Energy':Energy,'limit':max_res})

    return peaklis


@app.post('/peakDemand/Analysis/Energy/Filtered')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_awsdb)):
    peaklis = []

    try:
        value = data.get('date')

        if value and isinstance(value, str):
            with db.cursor() as awscur:
                awscur.execute(f"SELECT peakdemand FROM EMS.peakdemanddaily where polledTime = '{value}';")

                res = awscur.fetchall()
                print(res)

                if len(res) > 0:
                    if res[0][0] != None:
                        max_res = res[0][0]
                        if max_res > 4500:
                            max_res = 4500
                    else:
                        max_res = None
                else:
                    max_res = None

                if max_res != None:
                    # print(max_res)
                    max_res = round(max_res)

                    awscur.execute(f"SELECT round(sum(mvp1+mvp2+mvp3+mvp4),2) FROM EMS.peakVsKVA where peakDemand > {max_res} and polledTime >= '{value} 00:00:00' and polledTime <= '{value} 23:59:00';")

                    energyRes = awscur.fetchall()

                    if energyRes[0][0] != None:
                        Energy = energyRes[0][0]
                    else:
                        Energy = 0

                    peaklis.append({'Energy':Energy,'limit':max_res})             
    
    except mysql.connector.Error as e:
        return JSONResponse(content={"error": ["MySQL connection error",e]}, status_code=500)

    return peaklis


@app.post('/peakDemand/Analysis/Energy/Peak/Filtered')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_awsdb)):
    peaklis = []

    try:
        value = data.get('date')
        peak = data.get('peak')

        if value and peak and isinstance(value, str):
            with db.cursor() as awscur:
                if peak != None:
                    # print(max_res)
                    peak = round(peak)

                    awscur.execute(f"""SELECT ROUND(SUM(mvp1 + mvp2 + mvp3 + mvp4), 2) AS TotalMVP
                                        FROM EMS.peakVsKVA
                                        WHERE peakDemand > {peak} 
                                        AND polledTime >= '{value} 00:00:00'
                                        AND polledTime < '{value} 23:59:59';
                                        """)

                    energyRes = awscur.fetchall()

                    if energyRes[0][0] != None:
                        Energy = energyRes[0][0]
                    else:
                        Energy = 0

                    peaklis.append({'Energy':Energy,'limit':peak})             
    
    except mysql.connector.Error as e:
        return JSONResponse(content={"error": ["MySQL connection error",e]}, status_code=500)

    return peaklis

@app.get('/peakDemand/HundredAnalysis/HourWise')
def peak_demand_date(db: mysql.connector.connect = Depends(get_meterdb)):
    peaklis = []

    try:
        aws_db = get_awsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    awscur = aws_db.cursor()

    awscur.execute("SELECT maxAvgPeak FROM EMS.peakShavingLogic where polledTime >= curdate() order by polledTime desc limit 1;")

    res = awscur.fetchall()

    if len(res) > 0:
        if res[0][0] != None:
            max_res = res[0][0]
        else:
            max_res = None
    else:
        max_res = None

    if max_res != None:
        # print(max_res)
        max_res = round(max_res)

        max_res = max_res - ((max_res*2)/100)

        if max_res > 4400:
            max_res = 4400

        print(max_res)

        awscur.execute(f"SELECT peakdemand,polledTime FROM EMS.peakdemandHourly where polledTime >= curdate() and peakdemand >= {max_res};")

        peakHr = awscur.fetchall()

        if len(peakHr) > 0:
            for i in peakHr:
                polledTime = str(i[1])[11:]
                peaklis.append({'polledTime':polledTime,'Demand':i[0],'limit':max_res})
        else:
            peaklis.append({'polledTime':None,'Demand':None,'limit':max_res})
    
    return peaklis

@app.post('/peakDemand/HundredAnalysis/HourWise/Filtered')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_awsdb)):
    peaklis = []

    try:
        value = data.get('date')

        if value and isinstance(value, str):
            with db.cursor() as awscur:
                awscur.execute(f"SELECT maxAvgPeak FROM EMS.peakShavingLogic where polledTime >= '{value} 00:00:00' and polledTime <= '{value} 23:59:00' order by polledTime desc limit 1;")

                res = awscur.fetchall()

                if len(res) > 0:
                    if res[0][0] != None:
                        max_res = res[0][0]
                    else:
                        max_res = None
                else:
                    max_res = None

                if max_res != None:
                    # print(max_res)
                    max_res = round(max_res)

                    max_res = max_res - ((max_res*2)/100)

                    if max_res > 4400:
                        max_res = 4400

                    awscur.execute(f"SELECT peakdemand,polledTime FROM EMS.peakdemandHourly where polledTime >= '{value} 00:00:00' and polledTime <= '{value} 23:59:00' and peakdemand >= {max_res};")

                    peakHr = awscur.fetchall()

                    if len(peakHr) > 0:
                        for i in peakHr:
                            polledTime = str(i[1])[11:]
                            peaklis.append({'polledTime':polledTime,'Demand':i[0],'limit':max_res})
                    else:
                        peaklis.append({'polledTime':None,'Demand':None,'limit':max_res})
    
    except mysql.connector.Error as e:
        return JSONResponse(content={"error": ["MySQL connection error",e]}, status_code=500)

    return peaklis



@app.post('/peakDemand/HundredAnalysis/HourWise/Peak/Filtered')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_awsdb)):
    peaklis = []

    try:
        value = data.get('date')
        peak = data.get('peak')

        if value and peak and isinstance(value, str):
            with db.cursor() as awscur:

                if peak != None:
                    # print(max_res)
                    peak = round(peak)

                    awscur.execute(f"SELECT peakdemand,polledTime FROM EMS.peakdemandHourly where polledTime >= '{value} 00:00:00' and polledTime <= '{value} 23:59:00' and peakdemand >= {peak};")

                    peakHr = awscur.fetchall()

                    if len(peakHr) > 0:
                        for i in peakHr:
                            polledTime = str(i[1])[11:]
                            peaklis.append({'polledTime':polledTime,'Demand':i[0],'limit':peak})
                    else:
                        peaklis.append({'polledTime':None,'Demand':None,'limit':peak})
    
    except mysql.connector.Error as e:
        return JSONResponse(content={"error": ["MySQL connection error",e]}, status_code=500)

    return peaklis



@app.get('/peakDemand/HundredAnalysis/graph')
def peak_demand_date(db: mysql.connector.connect = Depends(get_meterdb)):
    peaklis = []

    try:
        aws_db = get_awsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    awscur = aws_db.cursor()
    
    awscur.execute("SELECT peakdemand FROM EMS.peakdemanddaily where polledTime = curdate();")

    res = awscur.fetchall()

    if len(res) > 0:
        if res[0][0] != None:
            max_res = res[0][0]
        else:
            max_res = None
    else:
        max_res = None

    if max_res != None:
        print(max_res)
        max_res = round(max_res)
        
        max_res = math.ceil(max_res/100)*100

        peak1 = max_res
        peak2 = max_res-100
        peak3 = max_res-200
        peak4 = max_res-300
        peak5 = max_res-400
        peak6 = max_res-500

        print(peak1,peak2,peak3,peak4,peak5,peak6)

        awscur.execute(f"""select p{peak6}to{peak5},p{peak5}to{peak4},p{peak4}to{peak3},
                       p{peak3}to{peak2},p{peak2}to{peak1},totalCount,polledTime from EMS.PeakCountHourly where polledTime >= curdate();""")
        
        peak_val = awscur.fetchall()

        for i in peak_val:
            polledTime = str(i[6])[11:13]
            if i[0] != None:
                peakres1 = (i[0]/i[5])*100
            else:
                peakres1 = 0
            
            if i[1] != None:
                peakres2 = (i[1]/i[5])*100
            else:
                peakres2 = 0
            
            if i[2] != None:
                peakres3 = (i[2]/i[5])*100
            else:
                peakres3 = 0
            
            if i[3] != None:
                peakres4 = (i[3]/i[5])*100
            else:
                peakres4 = 0
            
            if i[4] != None:
                peakres5 = (i[4]/i[5])*100
            else:
                peakres5 = 0
            
            peaklis.append({'polledTime':polledTime,f"count_{peak6}to{peak5}":peakres1,f"count_{peak5}to{peak4}":peakres2,
                            f"count_{peak4}to{peak3}":peakres3,f"count_{peak3}to{peak2}":peakres4,f"count_{peak2}to{peak1}":peakres5})

    return peaklis


@app.post('/peakDemand/HundredAnalysis/graph/Filtered')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_awsdb)):
    peaklis = []

    try:
        value = data.get('date')

        if value and isinstance(value, str):
            with db.cursor() as awscur:
    
                awscur.execute(f"SELECT peakdemand FROM EMS.peakdemanddaily where polledTime = '{value}';")

                res = awscur.fetchall()

                if len(res) > 0:
                    if res[0][0] != None:
                        max_res = res[0][0]
                    else:
                        max_res = None
                else:
                    max_res = None

                if max_res != None:
                    print(max_res)
                    max_res = round(max_res)
                    
                    max_res = math.ceil(max_res/100)*100

                    peak1 = max_res
                    peak2 = max_res-100
                    peak3 = max_res-200
                    peak4 = max_res-300
                    peak5 = max_res-400
                    peak6 = max_res-500

                    awscur.execute(f"""select p{peak6}to{peak5},p{peak5}to{peak4},p{peak4}to{peak3},
                                p{peak3}to{peak2},p{peak2}to{peak1},totalCount,polledTime from EMS.PeakCountHourly where polledTime >= '{value} 00:00:00' and polledTime <= '{value} 23:59:00';""")
                    
                    peak_val = awscur.fetchall()

                    for i in peak_val:
                        polledTime = str(i[6])[11:13]
                        if i[0] != None:
                            peakres1 = (i[0]/i[5])*100
                        else:
                            peakres1 = 0
                        
                        if i[1] != None:
                            peakres2 = (i[1]/i[5])*100
                        else:
                            peakres2 = 0
                        
                        if i[2] != None:
                            peakres3 = (i[2]/i[5])*100
                        else:
                            peakres3 = 0
                        
                        if i[3] != None:
                            peakres4 = (i[3]/i[5])*100
                        else:
                            peakres4 = 0
                        
                        if i[4] != None:
                            peakres5 = (i[4]/i[5])*100
                        else:
                            peakres5 = 0
                        
                        peaklis.append({'polledTime':polledTime,f"count_{peak6}to{peak5}":peakres1,f"count_{peak5}to{peak4}":peakres2,
                            f"count_{peak4}to{peak3}":peakres3,f"count_{peak3}to{peak2}":peakres4,f"count_{peak2}to{peak1}":peakres5})

    
    except mysql.connector.Error as e:
        return JSONResponse(content={"error": ["MySQL connection error",e]}, status_code=500)

    return peaklis



@app.get('/peakDemand/HundredAnalysis')
def peak_demand_date(db: mysql.connector.connect = Depends(get_meterdb)):
    peaklis = []

    try:
        aws_db = get_awsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    awscur = aws_db.cursor()

    awscur.execute("SELECT peakdemand FROM EMS.peakdemanddaily where polledTime = curdate();")

    res = awscur.fetchall()

    if len(res) > 0:
        if res[0][0] != None:
            max_res = res[0][0]
        else:
            max_res = None
    else:
        max_res = None

    if max_res != None:
        max_res = round(max_res)
        
        max_res = math.ceil(max_res/100)*100

        limit = 3000

        output_string = ""
        vallis = []

        for i in range(limit, max_res-100, 100):
            vallis.append(f"{i}-{i+100}")
            output_string += f"count(p{i}to{i+100}),"

        output_string += f"count(p{max_res-100}to{max_res})"

        print(output_string)

        awscur.execute(f"select {output_string} from EMS.PeakCountHourly where polledTime >= curdate()")

        peak_val = awscur.fetchall()

        peakDict = {}

        for i in range(0,len(vallis)):
            peakDict[vallis[i]] = peak_val[0][i]      
    
    peaklis.append(peakDict)
    
    return peaklis


@app.post('/peakDemand/HundredAnalysis/Filtered')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_awsdb)):
    peaklis = []

    try:
        value = data.get('date')

        if value and isinstance(value, str):
            with db.cursor() as awscur:

                awscur.execute(f"SELECT peakdemand FROM EMS.peakdemanddaily where polledTime = '{value}';")

                res = awscur.fetchall()

                if len(res) > 0:
                    if res[0][0] != None:
                        max_res = res[0][0]
                    else:
                        max_res = None
                else:
                    max_res = None

                if max_res != None:
                    max_res = round(max_res)
                    
                    max_res = math.ceil(max_res/100)*100

                    limit = 3000

                    output_string = ""
                    vallis = []

                    for i in range(limit, max_res-100, 100):
                        vallis.append(f"{i}-{i+100}")
                        output_string += f"count(p{i}to{i+100}),"

                    output_string += f"count(p{max_res-100}to{max_res})"

                    print(output_string)

                    awscur.execute(f"select {output_string} from EMS.PeakCountHourly where polledTime >= '{value} 00:00:00' and polledTime <= '{value} 23:59:00'")

                    peak_val = awscur.fetchall()

                    peakDict = {}

                    for i in range(0,len(vallis)):
                        peakDict[vallis[i]] = peak_val[0][i]      

                    peaklis.append(peakDict)            

    except mysql.connector.Error as e:
        return JSONResponse(content={"error": ["MySQL connection error",e]}, status_code=500)

    return peaklis



@app.get('/IoeBattery/EnergyVsPacksoc')
def peak_demand_date(db: mysql.connector.connect = Depends(get_meterdb)):
    energyPack = []
    try:
        processed_db = get_awsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    awscur = processed_db.cursor()

    awscur.execute("""SELECT 
                        polledTime,
                        Energyst1, Energyst2, Energyst3, Energyst4, Energyst5,
                        packSocst1, packSocst2, packSocst3, packSocst4, packSocst5
                    FROM EMS.ioeMinWise
                    WHERE polledTime >= CURDATE()
                    ORDER BY polledTime;
                    """)
    
    res = awscur.fetchall()

    for i in res:
        polledTime = str(i[0])[11:16]
        Energyst1 = i[1]
        Energyst2 = i[2]
        Energyst3 = i[3]
        Energyst4 = i[4]
        Energyst5 = i[5]
        packSocst1 = i[6]
        packSocst2 = i[7]
        packSocst3 = i[8]
        packSocst4 = i[9]
        packSocst5 = i[10]

        energyPack.append({'polledTime':polledTime,'Energyst1':Energyst1,'Energyst2':Energyst2,'Energyst3':Energyst3,
                           'Energyst4':Energyst4,'Energyst5':Energyst5,'packSocst1':packSocst1,'packSocst2':packSocst2,
                           'packSocst3':packSocst3,'packSocst4':packSocst4,'packSocst5':packSocst5})

    return energyPack

@app.post('/IoeBattery/EnergyVsPacksoc/Filtered')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_awsdb)):
    energyPack = []

    try:
        value = data.get('date')

        if value and isinstance(value, str):
            with db.cursor() as bms_cur:
                bms_cur.execute(f"""SELECT 	polledTime,Energyst1,Energyst2,Energyst3,Energyst4,Energyst5,
                                            packSocst1,packSocst2,packSocst3,packSocst4,packSocst5
                                    FROM 	EMS.ioeMinWise 
                                    where 	polledTime >= '{value} 00:00:00' and polledTime <= '{value} 23:59:00';""")

                res = bms_cur.fetchall()

                for i in res:
                    polledTime = str(i[0])[11:16]
                    Energyst1 = i[1]
                    Energyst2 = i[2]
                    Energyst3 = i[3]
                    Energyst4 = i[4]
                    Energyst5 = i[5]
                    packSocst1 = i[6]
                    packSocst2 = i[7]
                    packSocst3 = i[8]
                    packSocst4 = i[9]
                    packSocst5 = i[10]

                    energyPack.append({'polledTime':polledTime,'Energyst1':Energyst1,'Energyst2':Energyst2,'Energyst3':Energyst3,
                                    'Energyst4':Energyst4,'Energyst5':Energyst5,'packSocst1':packSocst1,'packSocst2':packSocst2,
                                    'packSocst3':packSocst3,'packSocst4':packSocst4,'packSocst5':packSocst5})

    except mysql.connector.Error as e:
        return JSONResponse(content={"error": ["MySQL connection error",e]}, status_code=500)

    return energyPack

@app.get('/chillerDashboard/ChillerLoading')
def peak_demand_date(db: mysql.connector.connect = Depends(get_meterdb)):
    ChillerLoading_PH1_PH2=[]
    try:
        processed_db = get_meterdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
   
    bms_cur = processed_db.cursor()

    bms_cur.execute("SELECT c1loading,c2loading,c3loading,c4loading,lastTimestamp FROM meterdata.chillarloading where lastTimestamp >= curdate()")
   
    res = bms_cur.fetchall()

    # print(res)

    for i in res:
        polledTime = str(i[4])[11:16]
        if(i[0]==None):
            c1loading=0
        else:
            c1loading=round(i[0],2)

        if(i[1]==None):
            c2loading=0
        else:
            c2loading=round(i[1],2)

        if(i[2]==None):
            c3loading=0
        else:
            c3loading=round(i[2],2)

        if(i[3]==None):
            c4loading=0
        else:
            c4loading=round(i[3],2)

    bms_cur.execute("SELECT c5loading,c6loading,c7loading,c8loading,timestamp FROM meterdata.chillarloading5678 where timestamp >= curdate();")
    res = bms_cur.fetchall()
    for i in res:
        polledTime = str(i[4])[11:16]
        if(i[0]==None):
            c5loading=0
        else:
            c5loading=round(i[0],2)

        if(i[1]==None):
            c6loading=0
        else:
            c6loading=round(i[1],2)

        if(i[2]==None):
            c7loading=0
        else:
            c7loading=round(i[2],2)

        if(i[3]==None):
            c8loading=0
        else:
            c8loading=round(i[3],2)


        ChillerLoading_PH1_PH2.append({'Phase2c1loading':c1loading,'Phase2c2loading':c2loading,'Phase2c3loading':c3loading,'Phase2c4loading':c4loading,'Phase1c5loading':c5loading,'Phase1c6loading':c6loading,'Phase1c7loading':c7loading,'Phase1c8loading':c8loading,'polledTime':polledTime})
   

    return ChillerLoading_PH1_PH2


@app.get('/Deisel/analytics/graph')
def peak_demand_date(db: mysql.connector.connect = Depends(get_awsdb)):
    diesel_list = []
    try:
        processed_db = get_awsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    bms_cur = processed_db.cursor()

    bms_cur.execute("SELECT polledTime,dg1Energy,dg2Energy,dg3Energy,dg4Energy,dg5Energy FROM EMS.dieselQuarterly where polledTime >= curdate();")

    res = bms_cur.fetchall()

    for i in res:
        polledTime = str(i[0])[11:16]

        diesel_list.append({'Timestamp':polledTime,'DGNum_1_energy_difference':i[1],'DGNum_2_energy_difference':i[2],'DGNum_3_energy_difference':i[3],
                            'DGNum_4_energy_difference':i[4],'DGNum_5_energy_difference':i[5]})
    
    return diesel_list


@app.post('/Deisel/analytics/graph/DateFilter')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_awsdb)):
    diesel_list = []

    try:
        value = data.get('date')

        if value and isinstance(value, str):
            with db.cursor() as bms_cur:
                bms_cur.execute(f"SELECT polledTime,dg1Energy,dg2Energy,dg3Energy,dg4Energy,dg5Energy FROM EMS.dieselQuarterly where polledTime >= '{value} 00:00:00' and polledTime <= '{value} 23:59:00';")

                res = bms_cur.fetchall()

                for i in res:
                    polledTime = str(i[0])[11:16]

                    diesel_list.append({'Timestamp':polledTime,'DGNum_1_energy_difference':i[1],'DGNum_2_energy_difference':i[2],'DGNum_3_energy_difference':i[3],
                                        'DGNum_4_energy_difference':i[4],'DGNum_5_energy_difference':i[5]})

    except mysql.connector.Error as e:
        return JSONResponse(content={"error": ["MySQL connection error",e]}, status_code=500)

    return diesel_list


@app.get('/fiveminWise')
def peak_demand_date(db: mysql.connector.connect = Depends(get_awsdb)):
    min_list = []
    try:
        processed_db = get_awsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    bms_cur = processed_db.cursor()

    bms_cur.execute("SELECT polledTime,wheeled,grid,wheeled2,wind FROM EMS.fiveMinData where polledTime >= curdate();")

    res = bms_cur.fetchall()

    for i in res:
        polledTime = str(i[0])[11:16]
        if i[1] != None:
            wheel1 = i[1]
        else:
            wheel1 = 0
        if i[2] != None:
            grid = i[2]
        else:
            grid = 0
        if i[3] != None:
            wheel2 = i[3]
        else:
            wheel2 = 0
        if i[4] != None:
            wind = i[4]
        else:
            wind = 0
        
        grid = grid-wind-wheel1-wheel2
        if grid<0:
            grid = 0 
        min_list.append({'polledTime':polledTime,'wheeledEnergy':i[1],'gridEnergy':grid,'wheeledEnergy2':i[3],'windEnergy':i[4]})

    return min_list

@app.post('/filtered/fiveminWise')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_awsdb)):
    min_list = []

    try:
        value = data.get('date')

        if value and isinstance(value, str):
            with db.cursor() as bmscur:
                bmscur.execute(f"SELECT polledTime,wheeled,grid,wheeled2,wind FROM EMS.fiveMinData where polledTime >= '{value} 00:00:00' and polledTime <= '{value} 23:59:00'")

                res = bmscur.fetchall()

                for i in res:
                    polledTime = str(i[0])[11:16]
                    if i[1] != None:
                        wheel1 = i[1]
                    else:
                        wheel1 = 0
                    if i[2] != None:
                        grid = i[2]
                    else:
                        grid = 0
                    if i[3] != None:
                        wheel2 = i[3]
                    else:
                        wheel2 = 0
                    if i[4] != None:
                        wind = i[4]
                    else:
                        wind = 0
                    
                    grid = grid-wind-wheel1-wheel2
                    if grid<0:
                        grid = 0 
                    min_list.append({'polledTime':polledTime,'wheeledEnergy':i[1],'gridEnergy':grid,'wheeledEnergy2':i[3],'windEnergy':i[4]})

    except mysql.connector.Error as e:
        return JSONResponse(content={"error": ["MySQL connection error",e]}, status_code=500)

    return min_list


@app.get('/BuildingConsumption/BlockWise')
def peak_demand_date(db: mysql.connector.connect = Depends(get_meterdb)):
    BlockWise_Response = []
    try:
        processed_db = get_meterdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
   
    bms_cur = processed_db.cursor()

    bms_cur.execute("SELECT timestamp,ABLOCK,BBlock,CBLOCK,DBLOCK,EBLOCK,MLCP,Utility,auditorium FROM meterdata.BlockwiseDaywise where timestamp >= curdate();")
   
    res = bms_cur.fetchall()

    polledTime = str(res[0][0])[8:10]+"/"+str(res[0][0])[5:7]+"/"+str(res[0][0])[0:4]

    print(polledTime)

    if res[0][1] != None:
        ablock = round(res[0][1])
    else:
        ablock = 0

    if res[0][2] != None:
        bblock = round(res[0][2])
    else:
        bblock = 0

    if res[0][3] != None:
        cblock = round(res[0][3])
    else:
        cblock = 0

    if res[0][4] != None:
        dblock = round(res[0][4])
    else:
        dblock = 0

    if res[0][5] != None:
        eblock = round(res[0][5])
    else:
        eblock = 0
    
    if res[0][6] != None:
        mlcp = round(res[0][6])
    else:
        mlcp = 0
    
    if res[0][7] != None:
        utility = round(res[0][7])
    else:
        utility = 0
    
    if res[0][8] != None:
        audi = round(res[0][8])
    else:
        audi = 0


    BlockWise_Response.append({'timestamp':polledTime,'ABLOCK':ablock,'BBlock':bblock,'CBLOCK':cblock,'DBLOCK':dblock,'EBLOCK':eblock,'MLCP':mlcp,'Utility':utility,'auditorium':audi})
    bms_cur.close()
    processed_db.close()

    return BlockWise_Response


@app.post('/filtered/BuildingConsumption/BlockWise')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_awsdb)):
    BlockWise_Response = []

    try:
        value = data.get('date')

        if value and isinstance(value, str):
            with db.cursor() as bmscur:
                bmscur.execute(f"SELECT timestamp,ABLOCK,BBlock,CBLOCK,DBLOCK,EBLOCK,MLCP,Utility,auditorium FROM meterdata.BlockwiseDaywise where timestamp >= '{value} 00:00:00' and timestamp <= '{value} 23:59:00';")           

                res = bmscur.fetchall()

                polledTime = str(res[0][0])[8:10]+"/"+str(res[0][0])[5:7]+"/"+str(res[0][0])[0:4]

                print(polledTime)

                if res[0][1] != None:
                    ablock = round(res[0][1])
                else:
                    ablock = 0

                if res[0][2] != None:
                    bblock = round(res[0][2])
                else:
                    bblock = 0

                if res[0][3] != None:
                    cblock = round(res[0][3])
                else:
                    cblock = 0

                if res[0][4] != None:
                    dblock = round(res[0][4])
                else:
                    dblock = 0

                if res[0][5] != None:
                    eblock = round(res[0][5])
                else:
                    eblock = 0
                
                if res[0][6] != None:
                    mlcp = round(res[0][6])
                else:
                    mlcp = 0
                
                if res[0][7] != None:
                    utility = round(res[0][7])
                else:
                    utility = 0
                
                if res[0][8] != None:
                    audi = round(res[0][8])
                else:
                    audi = 0


                BlockWise_Response.append({'timestamp':polledTime,'ABLOCK':ablock,'BBlock':bblock,'CBLOCK':cblock,'DBLOCK':dblock,'EBLOCK':eblock,'MLCP':mlcp,'Utility':utility,'auditorium':audi})
                bmscur.close()
                db.close()

    except mysql.connector.Error as e:
        return JSONResponse(content={"error": ["MySQL connection error",e]}, status_code=500)

    return BlockWise_Response



def stdateFunc(dated):
    mon = dated[5:]

    if len(mon) == 1:
        stdate = dated[0:5]+"0"+mon+"-01"
    else:
        stdate = dated[0:5]+mon+"-01"

    return stdate

def enddateFunct(dated):
    mon = dated[5:]

    if mon == "2":
        dt = "-28"
    elif mon in ("1","3","5","7","8","10","12"):
        dt = "-31"
    else:
        dt = "-30"
    
    if len(mon) == 1:
        stdate = dated[0:5]+"0"+mon+dt
    else:
        stdate = dated[0:5]+mon+dt

    return stdate


@app.get('/peakMonthly')
def peak_demand_date(db: mysql.connector.connect = Depends(get_awsdb)):
    peak_lis = []
    try:
        processed_db = get_awsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    bms_cur = processed_db.cursor()

    bms_cur.execute("SELECT polledDate,peakDemand FROM EMS.peakMonthly where polledDate >= date_sub(now(),interval 365 day) and polledDate <= curdate();")

    res = bms_cur.fetchall()

    for i in res:
        peak_lis.append({'polledDate':i[0],'peakDemand':i[1]})
    
    return peak_lis

@app.post('/filtered/peakMontly')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_awsdb)):
    peak_lis = []

    try:
        stdate = data.get('date')
        enddate = data.get('enddate')

        if stdate and enddate and isinstance(stdate, str) and isinstance(enddate, str):
            stdate = stdateFunc(stdate)
            enddate = enddateFunct(enddate)
            with db.cursor() as bmscur:
                bmscur.execute(f"SELECT polledDate,peakDemand FROM EMS.peakMonthly where date(polledDate) >='{stdate}' and date(polledDate) <= '{enddate}';")

                res = bmscur.fetchall()

                for i in res:
                    peak_lis.append({'polledDate':i[0],'peakDemand':i[1]})

        elif stdate and isinstance(stdate, str):
            stdate = stdateFunc(stdate)
            with db.cursor() as bmscur:
                bmscur.execute(f"SELECT polledDate,peakDemand FROM EMS.peakMonthly where date(polledDate) >='{stdate}' and date(polledDate) <= curdate();")

                res = bmscur.fetchall()

                for i in res:
                    peak_lis.append({'polledDate':i[0],'peakDemand':i[1]})

    except mysql.connector.Error as e:
        return JSONResponse(content={"error": ["MySQL connection error",e]}, status_code=500)

    return peak_lis


@app.get('/gridMonthly')
def peak_demand_date(db: mysql.connector.connect = Depends(get_awsdb)):
    grid_lis = []
    try:
        processed_db = get_awsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    bms_cur = processed_db.cursor()

    bms_cur.execute("SELECT polledDate,Energy FROM EMS.gridMonthly where polledDate >= date_sub(now(),interval 365 day) and polledDate <= curdate();")

    res = bms_cur.fetchall()

    for i in res:
        grid_lis.append({'polledDate':i[0],'Energy':i[1]})
    
    return grid_lis


@app.post('/filtered/gridMonthly')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_awsdb)):
    grid_lis = []

    try:
        stdate = data.get('date')
        enddate = data.get('enddate')

        if stdate and enddate and isinstance(stdate, str) and isinstance(enddate, str):
            stdate = stdateFunc(stdate)
            enddate = enddateFunct(enddate)
            with db.cursor() as bmscur:
                bmscur.execute(f"SELECT polledDate,Energy FROM EMS.gridMonthly where date(polledDate) >='{stdate}' and date(polledDate) <= '{enddate}';")

                res = bmscur.fetchall()

                for i in res:
                    grid_lis.append({'polledDate':i[0],'Energy':i[1]})

        elif stdate and isinstance(stdate, str):
            stdate = stdateFunc(stdate)
            with db.cursor() as bmscur:
                bmscur.execute(f"SELECT polledDate,Energy FROM EMS.gridMonthly where date(polledDate) >='{stdate}' and date(polledDate) <= curdate();")

                res = bmscur.fetchall()

                for i in res:
                    grid_lis.append({'polledDate':i[0],'Energy':i[1]})

    except mysql.connector.Error as e:
        return JSONResponse(content={"error": ["MySQL connection error",e]}, status_code=500)

    return grid_lis


@app.get('/minWise')
def peak_demand_date(db: mysql.connector.connect = Depends(get_awsdb)):
    min_list = []
    try:
        processed_db = get_awsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    bms_cur = processed_db.cursor()

    bms_cur.execute("SELECT polledTime,wheeled,grid FROM EMS.minWiseData where polledTime >= curdate();")

    res = bms_cur.fetchall()

    for i in res:
        polledTime = str(i[0])[11:16]
        min_list.append({'polledTime':polledTime,'wheeledEnergy':i[1],'gridEnergy':i[2]})

    return min_list


@app.post('/filtered/minWise')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_awsdb)):
    min_list = []

    try:
        value = data.get('date')

        if value and isinstance(value, str):
            with db.cursor() as bmscur:
                bmscur.execute(f"SELECT polledTime,wheeled,grid FROM EMS.minWiseData where polledTime >= '{value} 00:00:00' and polledTime <= '{value} 23:59:00'")

                res = bmscur.fetchall()

                for i in res:
                    polledTime = str(i[0])[11:16]
                    min_list.append({'polledTime':polledTime,'wheeledEnergy':i[1],'gridEnergy':i[2]})

    except mysql.connector.Error as e:
        return JSONResponse(content={"error": ["MySQL connection error",e]}, status_code=500)

    return min_list



@app.get('/BuildingConsumption/TopTenClients')
def peak_demand_date(db: mysql.connector.connect = Depends(get_meterdb)):
    TopTenClients_Response = []
    try:
        processed_db = get_meterdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
   
    bms_cur = processed_db.cursor()

    bms_cur.execute("SELECT ACRI,pfizer,SGRI,tatacommunications,ginger,axxlent,caterpillar,IFMR,NMS,TCS FROM meterdata.toptenclientsdaywise where timestamp >= curdate();")
   
    res = bms_cur.fetchall()

    if res[0][0] != None:
        arci = round(res[0][0]) 
    else:
        arci = 0

    if res[0][1] != None:
        pfizer = round(res[0][1]) 
    else:
        pfizer = 0

    if res[0][2] != None:
        SGRI = round(res[0][2]) 
    else:
        SGRI = 0

    if res[0][3] != None:
        tatacommunications = round(res[0][3]) 
    else:
        tatacommunications = 0

    if res[0][4] != None:
        ginger = round(res[0][4]) 
    else:
        ginger = 0
    
    if res[0][5] != None:
        axxlent = round(res[0][5]) 
    else:
        axxlent = 0
    
    if res[0][6] != None:
        caterpillar = round(res[0][6]) 
    else:
        caterpillar = 0

    if res[0][7] != None:
        IFMR = round(res[0][7]) 
    else:
        IFMR = 0
    
    if res[0][8] != None:
        NMS = round(res[0][8]) 
    else:
        NMS = 0
    
    if res[0][9] != None:
        TCS = round(res[0][9]) 
    else:
        TCS = 0


    TopTenClients_Response.append({'ACRI':arci,'pfizer':pfizer,'SGRI':SGRI,'tatacommunications':tatacommunications,'ginger':ginger,
                                   'axxlent':axxlent,'caterpillar':caterpillar,'IFMR':IFMR,
                                   'NMS':NMS,'TCS':TCS})
    bms_cur.close()
    processed_db.close()

    return TopTenClients_Response



@app.post('/BuildingConsumption/TopTenClients/filtered')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_meterdb)):
    TopTenClients_Response = []

    try:
        value = data.get('date')

        if value and isinstance(value, str):
            with db.cursor() as bmscur:
                bmscur.execute(f"SELECT ACRI,pfizer,SGRI,tatacommunications,ginger,axxlent,caterpillar,IFMR,NMS,TCS FROM meterdata.toptenclientsdaywise where timestamp >= '{value} 00:00:00' and timestamp <= '{value} 23:59:00'")

                res = bmscur.fetchall()
                print(res)

                if res[0][0] != None:
                    arci = round(res[0][0]) 
                else:
                    arci = 0

                if res[0][1] != None:
                    pfizer = round(res[0][1]) 
                else:
                    pfizer = 0

                if res[0][2] != None:
                    SGRI = round(res[0][2]) 
                else:
                    SGRI = 0

                if res[0][3] != None:
                    tatacommunications = round(res[0][3]) 
                else:
                    tatacommunications = 0

                if res[0][4] != None:
                    ginger = round(res[0][4]) 
                else:
                    ginger = 0
                
                if res[0][5] != None:
                    axxlent = round(res[0][5]) 
                else:
                    axxlent = 0
                
                if res[0][6] != None:
                    caterpillar = round(res[0][6]) 
                else:
                    caterpillar = 0

                if res[0][7] != None:
                    IFMR = round(res[0][7]) 
                else:
                    IFMR = 0
                
                if res[0][8] != None:
                    NMS = round(res[0][8]) 
                else:
                    NMS = 0
                
                if res[0][9] != None:
                    TCS = round(res[0][9]) 
                else:
                    TCS = 0


                TopTenClients_Response.append({'ACRI':arci,'pfizer':pfizer,'SGRI':SGRI,'tatacommunications':tatacommunications,'ginger':ginger,
                                            'axxlent':axxlent,'caterpillar':caterpillar,'IFMR':IFMR,
                                            'NMS':NMS,'TCS':TCS})
                
    except mysql.connector.Error as e:
        return JSONResponse(content={"error": "MySQL connection error"}, status_code=500)

    return TopTenClients_Response


@app.get('/Analytics/rooftopSolar')
def peak_demand_date(db: mysql.connector.connect = Depends(get_awsdb)):
    roofTop_solar = []
    try:
        processed_db = get_awsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    bms_cur = processed_db.cursor()

    bms_cur.execute("SELECT polledTime,energy,irradiation,expph1Energy,expph1Energy,ph1Actual,ph2Actual FROM EMS.roofTopHour where polledTime >= curdate();")

    res = bms_cur.fetchall()

    for i in res:
        polledTime = str(i[0])[11:16]
        roofTop_solar.append({'polledTime':polledTime,'Energy':i[1],'irradiation':i[2],'expph1Energy':i[3],
                              'expph2Energy':i[4],'ph1Actual':i[5],'ph2Actual':i[6]})
        
    return roofTop_solar


@app.post('/Analytics/rooftopSolar/filtered')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_awsdb)):
    roofTop_solar = []
    try:
        value = data.get('date')

        if value and isinstance(value, str):
            with db.cursor() as bms_cur:

                bms_cur.execute(f"SELECT polledTime,energy,irradiation,expph1Energy,expph1Energy,ph1Actual,ph2Actual FROM EMS.roofTopHour where polledTime >= '{value} 00:00:00' and polledTime <= '{value} 23:59:00';")

                res = bms_cur.fetchall()

                for i in res:
                    polledTime = str(i[0])[11:16]
                    roofTop_solar.append({'polledTime':polledTime,'Energy':i[1],'irradiation':i[2],'expph1Energy':i[3],
                                        'expph2Energy':i[4],'ph1Actual':i[5],'ph2Actual':i[6]})
                    
    except mysql.connector.Error as e:
        return JSONResponse(content={"error": "MySQL connection error"}, status_code=500)
    
    return roofTop_solar

@app.get('/Upsanalytics/energy_VS_packsoc')
def peak_demand_date(db: mysql.connector.connect = Depends(get_emsdb)):
    ups_list = []
    try:
        processed_db = get_emsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    bms_cur = processed_db.cursor()

    bms_cur.execute("""SELECT MIN(pack_usable_soc) AS pack_usable_soc,
                            MAX(received_time) AS received_time,
                            MAX(upsbatterystatus) AS upsbatterystatus,
                            MAX(upschargingenergy) AS upschargingenergy,
                            MAX(upsdischargingenergy) AS upsdischargingenergy,
                            HOUR(received_time) AS hr,
                            MINUTE(received_time) AS mint
                        FROM 
                            EMS.EMSUPSBattery
                        WHERE 
                            DATE(received_time) = DATE_SUB(CURDATE(), INTERVAL 150 DAY)
                        GROUP BY 
                            hr, mint;""")
    
    res = bms_cur.fetchall()

    for i in res:
        polledTime = str(i[1])[11:16]
        if i[2] == 'IDLE':
            batteryEnergy = 0.01
        elif i[2] == 'CHG':
            batteryEnergy = i[3]/100
        elif i[2] == 'DCHG':
            batteryEnergy = i[4]/100
        ups_list.append({'packsoc':i[0],'batteryEnergy':batteryEnergy,'timestamp':polledTime,'batteryStatus':i[2]})

    bms_cur.close()
    processed_db.close()

    return ups_list   


@app.post('/filtered/Upsanalytics/energy_VS_packsoc')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_emsdb)):
    ups_list = []

    try:
        value = data.get('date')

        if value and isinstance(value, str):
            with db.cursor() as bmscur:
                bmscur.execute("""SELECT MIN(pack_usable_soc) AS pack_usable_soc,
                                        MAX(received_time) AS received_time,
                                        MAX(upsbatterystatus) AS upsbatterystatus,
                                        MAX(upschargingenergy) AS upschargingenergy,
                                        MAX(upsdischargingenergy) AS upsdischargingenergy,
                                        HOUR(received_time) AS hr,
                                        MINUTE(received_time) AS mint
                                    FROM 
                                        EMS.EMSUPSBattery
                                    WHERE 
                                        DATE(received_time) = DATE_SUB(CURDATE(), INTERVAL 150 DAY)
                                    GROUP BY 
                                        hr, mint;""")
                
                res = bmscur.fetchall()

                for i in res:
                    polledTime = str(i[1])[11:16]
                    if i[2] == 'IDLE':
                        batteryEnergy = 0.01
                    elif i[2] == 'CHG':
                        batteryEnergy = i[3]/100
                    elif i[2] == 'DCHG':
                        batteryEnergy = i[4]/100
                    
                    ups_list.append({'packsoc':i[0],'batteryEnergy':batteryEnergy,'timestamp':polledTime,'batteryStatus':i[2]})
    except mysql.connector.Error as e:
        return JSONResponse(content={"error": ["MySQL connection error",e]}, status_code=500)

    return ups_list


@app.get('/Upsanalytics/current_VS_voltage')
def peak_demand_date(db: mysql.connector.connect = Depends(get_emsdb)):
    ups_list = []
    try:
        processed_db = get_emsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    bms_cur = processed_db.cursor()

    bms_cur.execute("""SELECT max(received_time),max(batteryvoltage),max(batterycurrent),
                                hour(received_time) as hr,minute(received_time) as mint 
                                FROM EMS.EMSUPSBattery
                                where received_time >= curdate() 
                                group by hr,mint;""")
    
    res = bms_cur.fetchall()

    for i in res:
        polledTime = str(i[0])[11:16]
        ups_list.append({'polledTime':polledTime,'BatteryVoltage':i[1],'BatteryCurrent':i[2]})

    bms_cur.close()
    processed_db.close()

    return ups_list


@app.post('/filtered/Upsanalytics/current_VS_voltage')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_emsdb)):
    ups_list = []

    try:
        value = data.get('date')

        if value and isinstance(value, str):
            with db.cursor() as bmscur:
                bmscur.execute(f"SELECT max(received_time),max(batteryvoltage),max(batterycurrent),hour(received_time) as hr,minute(received_time) as mint FROM EMS.EMSUPSBattery where date(received_time) = '{value}' group by hr,mint;")

                res = bmscur.fetchall()

                for i in res:
                    polledTime = str(i[0])[11:16]
                    ups_list.append({'polledTime':polledTime,'BatteryVoltage':i[1],'BatteryCurrent':i[2]})

    except mysql.connector.Error as e:
        return JSONResponse(content={"error": ["MySQL connection error",e]}, status_code=500)

    return ups_list


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=5003)
