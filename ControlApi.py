from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
import mysql.connector
from fastapi.responses import JSONResponse
import psycopg2
import json

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

def get_cpm_2():
    db = psycopg2.connect(
            host="10.9.200.203",
            database="cpm_phase_2",
            user="rpuser",
            password="parkPassword")
    
    return db

API_mapping = {
    '1': 'http://localhost:8009/ioesinglestr',
    '2': 'http://localhost:8009/ioedoublestr',
    '3': 'http://localhost:8009/ioetriplestr',
    '4': 'http://localhost:8009/ioefourstr',
    '5': 'http://localhost:8009/ioefivestr',
}



@app.get('/ExcessRE/Details')
def peak_demand_date(db: mysql.connector.connect = Depends(get_emsdb)):

    ExcessREData=[]
    try:
        processed_db = get_awsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
   
    ems_cur = processed_db.cursor()

    ems_cur.execute("""SELECT 
                    polledTime,sum(ExcessRE),sum(Duration),sum(IOE_Stored_in),
                    sum(LTO_Stored_in),sum(Cold_Stored_in),sum(DeficitRE)
                    FROM EMS.ExcessREcard where date(polledTime)=curdate()""")
   
    res = ems_cur.fetchall()

    for i in res:
        polledTime = str(i[0])[11:19]
        if(i[1]==None):
            ExcessRE=0
        else:
            ExcessRE=round(i[1],2)
        if(i[2]==None):
            Duration=0
        else:
            Duration=round(i[2],2)

        if(i[3]==None):
            IOE_Stored_in=0
        else:
            IOE_Stored_in=round(i[3],2)
        if(i[4]==None):
            LTO_Stored_in=0
        else:
           LTO_Stored_in=round(i[4],2)
        if(i[5]==None):
            Cold_Stored_in=0
        else:
           Cold_Stored_in=round(i[5],2)

        if(i[6]==None):
            DeficitRE=0
        else:
            DeficitRE=(round(i[6],2)*-1)

        ExcessREData.append({'polledTime':polledTime,"ExcessRE":ExcessRE,"Duration":Duration,"IOE_Stored_in":IOE_Stored_in,"LTO_Stored_in":LTO_Stored_in,"Cold_Stored_in":Cold_Stored_in,"DeficitRE":DeficitRE})
    
    return ExcessREData


@app.post('/ExcessRE/Details/Filtered')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_awsdb)):

    ExcessREData=[]

    try:
        value = data.get('date')

        if value and isinstance(value, str):
            with db.cursor() as bmscur:
                bmscur.execute(f"""SELECT 
                        polledTime,sum(ExcessRE),sum(Duration),sum(IOE_Stored_in),
                        sum(LTO_Stored_in),sum(Cold_Stored_in),sum(DeficitRE)
                        FROM EMS.ExcessREcard where date(polledTime) = '{value}'""")

                res = bmscur.fetchall()

                for i in res:
                    polledTime = str(i[0])[11:19]
                    if(i[1]==None):
                        ExcessRE=0
                    else:
                        ExcessRE=round(i[1],2)
                    if(i[2]==None):
                        Duration=0
                    else:
                     Duration=round(i[2],2)

                    if(i[3]==None):
                        IOE_Stored_in=0
                    else:
                        IOE_Stored_in=round(i[3],2)

                    if(i[4]==None):
                        LTO_Stored_in=0
                    else:
                        LTO_Stored_in=round(i[4],2)

                    if(i[5]==None):
                        Cold_Stored_in=0
                    else:
                        Cold_Stored_in=round(i[5],2)

                    if(i[6]==None):
                        DeficitRE=0
                    else:
                        DeficitRE=(round(i[6],2)*-1)

                    ExcessREData.append({'polledTime':polledTime,"ExcessRE":ExcessRE,"Duration":Duration,"IOE_Stored_in":IOE_Stored_in,"LTO_Stored_in":LTO_Stored_in, "Cold_Stored_in":Cold_Stored_in,"DeficitRE":DeficitRE})
                
        
        return ExcessREData
    except mysql.connector.Error as e:
        print(e)
        return JSONResponse(content={"error": "MySQL connection error"}, status_code=500)

@app.get('/PeakTariff/Details')
def peak_demand_date(db: mysql.connector.connect = Depends(get_emsdb)):

    PeakTariffData=[]
    try:
        processed_db = get_awsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
   
    ems_cur = processed_db.cursor()

    ems_cur.execute("SELECT polledTime,IOE_Discharged,LTO_Discharged,Cold_Discharged FROM EMS.PeakTariffCard where date(polledTime)=curdate();")
   
    res = ems_cur.fetchall()

    # print(res)

    for i in res:
        polledTime = str(i[0])[11:19]
        if(i[1]==None):
            IOE_Discharge=0
        else:
            IOE_Discharge=(round(i[1],2)*-1)
        if(i[2]==None):
            LTO_Discharge=0
        else:
            LTO_Discharge=round(i[2],2)*-1

        if(i[3]==None):
            Cold_Discharge=0
        else:
            Cold_Discharge=round(i[3],2)

        PeakTariffData.append({'polledTime':polledTime,"IOE_Discharge":IOE_Discharge,"LTO_Discharge":LTO_Discharge,"Cold_Discharge":Cold_Discharge})
    
    return PeakTariffData


@app.post('/PeakTariff/Details/Filtered')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_awsdb)):

    PeakTariffData=[]

    try:
        value = data.get('date')

        if value and isinstance(value, str):
            with db.cursor() as bmscur:
                bmscur.execute(f"SELECT polledTime,IOE_Discharged,LTO_Discharged,Cold_Discharged FROM EMS.PeakTariffCard where date(polledTime) = '{value}'")

                res = bmscur.fetchall()

        for i in res:
            polledTime = str(i[0])[11:19]
            if(i[1]==None):
                IOE_Discharge=0
            else:
               IOE_Discharge=(round(i[1],2)*-1)
            if(i[2]==None):
              LTO_Discharge=0
            else:
              LTO_Discharge=round(i[2],2)*-1

            if(i[3]==None):
               Cold_Discharge=0
            else:
               Cold_Discharge=round(i[3],2)

            PeakTariffData.append({'polledTime':polledTime,"IOE_Discharge":IOE_Discharge,"LTO_Discharge":LTO_Discharge,"Cold_Discharge":Cold_Discharge})
                
        
        return PeakTariffData
    except mysql.connector.Error as e:
        print(e)
        return JSONResponse(content={"error": "MySQL connection error"}, status_code=500)


@app.post('/control/hourlyDetails/Filtered')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_awsdb)):

    hourlyDetailsGraph=[]

    try:
        value = data.get('date')

        if value and isinstance(value, str):
            with db.cursor() as bmscur:
                bmscur.execute(f"SELECT polledTime,ExcessRE,DeficitRE,Battery_storage,Total_energy,peak_demand FROM EMS.ExcessREhourly  where date(polledTime) = '{value}'")

                res = bmscur.fetchall()

        for i in res:
            polledTime = str(i[0])[11:16]
            if(i[1]==None):
                ExcessRE=0
            else:
               ExcessRE=(round(i[1],2))
            if(i[2]==None):
               DeficitRE=0
            else:
               DeficitRE=round(i[2],2)

            if(i[3]==None):
               Battery_storage=0
            else:
               Battery_storage=(round(i[3],2)*-1)
            if(i[4]==None):
               Total_energy=0
            else:
               Total_energy=round(i[4],2)
            if(i[5]==None):
               peak_demand=0
            else:
               peak_demand=round(i[5],2)
 

            hourlyDetailsGraph.append({'polledTime':polledTime,"excessRE":ExcessRE,"power":peak_demand,"DeficitRE":DeficitRE,"totalEnergy":Total_energy,"battery":Battery_storage})
                
        
        return hourlyDetailsGraph
    except mysql.connector.Error as e:
        print(e)
        return JSONResponse(content={"error": "MySQL connection error"}, status_code=500)
   
                
               


@app.get('/control/hourlyDetails')
def peak_demand_date(db: mysql.connector.connect = Depends(get_awsdb)):

    hourlyDetailsGraph=[]
    try:
        processed_db = get_awsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
   
    ems_cur = processed_db.cursor()

    ems_cur.execute("SELECT polledTime,ExcessRE,DeficitRE,Battery_storage,Total_energy,peak_demand FROM EMS.ExcessREhourly  where date(polledTime)=curdate();")
   
    res = ems_cur.fetchall()

    # print(res)

    for i in res:
        polledTime = str(i[0])[11:16]
        if(i[1]==None):
            ExcessRE=0
        else:
            ExcessRE=(round(i[1],2))
        if(i[2]==None):
            DeficitRE=0
        else:
            DeficitRE=round(i[2],2)

        if(i[3]==None):
            Battery_storage=0
        else:
            Battery_storage=(round(i[3],2)*-1)
        if(i[4]==None):
            Total_energy=0
        else:
            Total_energy=round(i[4],2)
        if(i[5]==None):
            peak_demand=0
        else:
            peak_demand=round(i[5],2)

        hourlyDetailsGraph.append({'polledTime':polledTime,"excessRE":ExcessRE,"power":peak_demand,"DeficitRE":DeficitRE,"totalEnergy":Total_energy,"battery":Battery_storage})
    
    return hourlyDetailsGraph

@app.get("/control/ioeDetails")
def get_ioe_details(db: mysql.connector.connect = Depends(get_emsdb)):
    Ioe_dict = {}

    try:
        emsdb = get_emsdb()
        emscur = emsdb.cursor()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})

    query = """
        SELECT batteryCurrent, batteryStatus, batteryVoltage,
               mainContactorStatus, prechargeContactorStatus, packSOC
        FROM EMS.ioeBatteryData
        WHERE strings = %s AND recordTimestamp >= current_date()
        ORDER BY recordId DESC LIMIT 1;
    """

    for string_id in range(1, 6):
        emscur.execute(query, (string_id,))
        result = emscur.fetchone()

        if result:
            Ioe_dict.update({
                f"batteryCurrent{string_id}": result[0],
                f"batteryStatus{string_id}": result[1],
                f"batteryVoltage{string_id}": result[2],
                f"mainCon{string_id}": result[3],
                f"preCon{string_id}": result[4],
                f"packSoc{string_id}": result[5],
            })
        else:
            Ioe_dict.update({
                f"batteryCurrent{string_id}": None,
                f"batteryStatus{string_id}": None,
                f"batteryVoltage{string_id}": None,
                f"mainCon{string_id}": None,
                f"preCon{string_id}": None,
                f"packSoc{string_id}": None,
            })

    emscur.close()
    return [Ioe_dict]

@app.get("/control/cellDetails")
def peak_demand_date(db: mysql.connector.connect = Depends(get_emsdb)):
    Ioe_list = []
    Ioe_dict = {}

    try:
        emsdb = get_emsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    emscur = emsdb.cursor()

    emscur.execute("""SELECT maxVoltage,minVoltage,maxcellNo,mincellNo FROM EMS.ioest1cell where polledTime >= curdate() order by polledTime desc limit 1;""")

    cellres1 = emscur.fetchall()

    if len(cellres1) > 0:
        Ioe_dict['maxVoltage1'] = cellres1[0][0]
        Ioe_dict['minVoltage1'] = cellres1[0][1]
        Ioe_dict['maxCell1'] = cellres1[0][2]
        Ioe_dict['minCell1'] = cellres1[0][3]
    else:
        Ioe_dict['maxVoltage1'] = None
        Ioe_dict['minVoltage1'] = None
        Ioe_dict['maxCell1'] = None
        Ioe_dict['minCell1'] = None
    

    emscur.execute("""SELECT maxVoltage,minVoltage,maxcellNo,mincellNo FROM EMS.ioest2cell where polledTime >= curdate() order by polledTime desc limit 1;""")

    cellres2 = emscur.fetchall()

    if len(cellres2) > 0:
        Ioe_dict['maxVoltage2'] = cellres2[0][0]
        Ioe_dict['minVoltage2'] = cellres2[0][1]
        Ioe_dict['maxCell2'] = cellres2[0][2]
        Ioe_dict['minCell2'] = cellres2[0][3]

    else:
        Ioe_dict['maxVoltage2'] = None
        Ioe_dict['minVoltage2'] = None
        Ioe_dict['maxCell2'] = None
        Ioe_dict['minCell2'] = None
    

    emscur.execute("""SELECT maxVoltage,minVoltage,maxcellNo,mincellNo FROM EMS.ioest3cell where polledTime >= curdate() order by polledTime desc limit 1;""")

    cellres3 = emscur.fetchall()

    if len(cellres3) > 0:
        Ioe_dict['maxVoltage3'] = cellres3[0][0]
        Ioe_dict['minVoltage3'] = cellres3[0][1]
        Ioe_dict['maxCell3'] = cellres3[0][2]
        Ioe_dict['minCell3'] = cellres3[0][3]

    else:
        Ioe_dict['maxVoltage3'] = None
        Ioe_dict['minVoltage3'] = None
        Ioe_dict['maxCell3'] = None
        Ioe_dict['minCell3'] = None
    

    emscur.execute("""SELECT maxVoltage,minVoltage,maxcellNo,mincellNo FROM EMS.ioest4cell where polledTime >= curdate() order by polledTime desc limit 1;""")

    cellres4 = emscur.fetchall()

    if len(cellres4) >0 :
        Ioe_dict['maxVoltage4'] = cellres4[0][0]
        Ioe_dict['minVoltage4'] = cellres4[0][1]
        Ioe_dict['maxCell4'] = cellres4[0][2]
        Ioe_dict['minCell4'] = cellres4[0][3]

    else:
        Ioe_dict['maxVoltage4'] = None
        Ioe_dict['minVoltage4'] = None
        Ioe_dict['maxCell4'] = None
        Ioe_dict['minCell4'] = None

    emscur.execute("""SELECT maxVoltage,minVoltage,maxcellNo,mincellNo FROM EMS.ioest5cell where polledTime >= curdate() order by polledTime desc limit 1;""")

    cellres5 = emscur.fetchall()

    if len(cellres5) > 0:
        Ioe_dict['maxVoltage5'] = cellres5[0][0]
        Ioe_dict['minVoltage5'] = cellres5[0][1]
        Ioe_dict['maxCell5'] = cellres5[0][2]
        Ioe_dict['minCell5'] = cellres5[0][3]

    else:
        Ioe_dict['maxVoltage5'] = None
        Ioe_dict['minVoltage5'] = None
        Ioe_dict['maxCell5'] = None
        Ioe_dict['minCell5'] = None

    emscur.close()
    
    Ioe_list.append(Ioe_dict)

    return Ioe_list



@app.post('/control/ioeControl')
def ioeControl(data: dict, db: mysql.connector.connect = Depends(get_emsdb)):
    try:
        print(data)
        polledTime = data.get('polledTime')
        functionCode = data.get('functionCode')
        controlStatus = data.get('controlStatus')
        strings = data.get('strings')
        crate = data.get('crate')

        for i in strings:
            print(i)

        functionCode = functionCode.upper()

        if functionCode == "OFF":
                ApiUrl = 'http://localhost:8009/ioeprocessoff'
                output_string = ""

                with db.cursor() as bms_cur:
                    sql = "INSERT INTO EMS.ioeInstantaneous(polledTime,functionCode,controlStatus,strings,httpLink,crate) values(%s,%s,%s,%s,%s,%s)"
                    val = (polledTime,functionCode,controlStatus,output_string,ApiUrl,crate)
                    
                    bms_cur.execute(sql,val)
                    db.commit()
                    return "Parameter Added Sucessfully"
        
        elif functionCode == "ON":
            if polledTime != None or functionCode != None or controlStatus !=None and strings != None:
                ApiUrl = API_mapping[str(len(strings))]
                output_string = ",".join(strings)
                ApiUrl = ApiUrl+'?strings='+output_string+','+controlStatus+'&crate='+crate
                print(ApiUrl)

            with db.cursor() as bms_cur:
                sql = "INSERT INTO EMS.ioeInstantaneous(polledTime,functionCode,controlStatus,strings,httpLink,crate) values(%s,%s,%s,%s,%s,%s)"
                val = (polledTime,functionCode,controlStatus,output_string,ApiUrl,crate)
                
                bms_cur.execute(sql,val)
                db.commit()
                return "Parameter Added Sucessfully"
        else:
            return "Parameters not available"
    except mysql.connector.Error as e:
        print(e)
        return JSONResponse(content={"error": "MySQL connection error"}, status_code=500)


@app.get('/control/UpsDetails')
def peak_demand_date(db: mysql.connector.connect = Depends(get_emsdb)):
    Ups_list = []
    
    try:
        emsdb = get_emsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    emscur = emsdb.cursor()

    emscur.execute("SELECT pack_usable_soc,upsbatterystatus,batteryvoltage,batterycurrent,contactorstatus,precontactorstatus FROM EMS.EMSUPSBattery where date(received_time) = curdate() order by upsrecordid desc limit 1;")

    res = emscur.fetchall()

    for i in res:
        Ups_list.append({'packSOC':i[0],'batteryStatus':i[1],'batteryVoltage':i[2],'batteryCurrent':i[3],
                         'mainConStatus':i[4],'preConStatus':i[5]})
    
    return Ups_list


@app.post('/control/HotwaterStorage')
def peak_demand_date(data: dict, db: mysql.connector.connect = Depends(get_emsdb)):

    try:
        polledTime = data.get('polledTime')
        functionCode = data.get('functionCode')
        controlStatus = data.get('controlStatus')

        if polledTime != None or functionCode != None or controlStatus !=None :
            with db.cursor() as bms_cur:
                sql = "INSERT INTO EMS.hotWaterInstant(polledTime,functionCode,controlStatus) values(%s,%s,%s)"
                val = (polledTime,functionCode,controlStatus)
                
                bms_cur.execute(sql,val)
                db.commit()
                print("Hot Water Parameters added")
                return "Parameter Added Sucessfully"


    except mysql.connector.Error as e:
        return JSONResponse(content={"error": "MySQL connection error"}, status_code=500)
    
@app.get('/control/HotwaterDetails')
def peak_demand_date(db: mysql.connector.connect = Depends(get_emsdb)):
    hotWater_list = []
    try:
        processed_db = get_emsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    try:
        awsdb = get_awsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    emscur = processed_db.cursor()
    awscur = awsdb.cursor()

    emscur.execute("SELECT storedWaterTemperature,tankFuildVolume,hotWaterSts FROM EMS.HotWaterStorage where date(recordtimestamp) = curdate() order by recordtimestamp desc limit 1;")

    res = emscur.fetchall()

    if len(res) > 0:

        if res[0][2] == "DCHG":
            sts = 'Discharge'
        if res[0][2] == "CHGRW":
            sts = 'Charge Recirculation'
        if res[0][2] == "CHGFW":
            sts = 'Charge Freshwater'
        if res[0][2] == "IDLE":
            sts = 'IDLE'
        
        storedWaterTemp = res[0][0]

        Mass = res[0][1]
    else:
        sts = None
        storedWaterTemp = None
        Mass = None

    awscur.execute("SELECT chiller1 FROM EMS.ChillerStatus where date(polledTime) = curdate() order by polledTime desc limit 1;")

    chres = awscur.fetchall()

    if len(chres) > 0:
        if chres[0][0] != None:
            if chres[0][0] == '1':
                ChSts = 'ON'
            else:
                ChSts = 'OFF'
        else:
            ChSts = 'OFF'
    else:
        ChSts = None

    hotWater_list.append({'storedWaterTemp':storedWaterTemp,'Mass':Mass,'hotWaterStatus':sts,'ChillerStatus':ChSts})

    return hotWater_list
    


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=5005)
