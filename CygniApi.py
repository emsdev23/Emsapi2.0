from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
import mysql.connector
from fastapi.responses import JSONResponse

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

def get_emsdb():
    db = mysql.connector.connect(
        host="121.242.232.211",
        user="emsroot",        
        password="22@teneT",
        database='Cygni',
        port=3306    
        )
    return db

@app.get('/Cygni/SlaveBatteryPCBTemperature')
def peak_demand_date(db: mysql.connector.connect = Depends(get_emsdb)):
    Consumption = []
    try:
        ems_db = get_emsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    result = {}
    
    emscur = ems_db.cursor()

    emscur.execute("""select recorded_at,Utype,pcb_temp_1,pcb_temp_2,pcb_temp_3,pcb_temp_4,pcb_temp_5,pcb_temp_6
                      from Cygni.SlaveControls;""")
    
    res = emscur.fetchall()

    if len(res) > 0:
        for i in res:
            polledTime = str(i[0])
            if i[1] in result.keys():
                result[i[1]].append({'timestamp':polledTime,"pcbTemp1":i[2],"pcbTemp2":i[3],"pcbTemp3":i[4],
                                     "pcbTemp4":i[5],"pcbTemp5":i[6],"pcbTemp6":i[7]})         
            else:
                result[i[1]] = [{'timestamp':polledTime,"pcbTemp1":i[2],"pcbTemp2":i[3],"pcbTemp3":i[4],
                                     "pcbTemp4":i[5],"pcbTemp5":i[6],"pcbTemp6":i[7]}]
    
    return [result]

@app.get('/Cygni/SlaveBatteryVoltage')
def peak_demand_date(db: mysql.connector.connect = Depends(get_emsdb)):
    Consumption = []
    try:
        ems_db = get_emsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    result = {}
    
    emscur = ems_db.cursor()

    emscur.execute("""select recorded_at,Utype,voltage_1,voltage_2,voltage_3,voltage_4,voltage_5,voltage_6,voltage_7,
                      voltage_8,voltage_9,voltage_10,voltage_11,voltage_12,voltage_13,voltage_14,voltage_15,voltage_16
                      from Cygni.SlaveControls;""")
    
    res = emscur.fetchall()

    if len(res) > 0:
        for i in res:
            polledTime = str(i[0])
            if i[1] in result.keys():
                result[i[1]].append({'timestamp':polledTime,'voltage1':i[2],'voltage2':i[3],'voltage3':i[4],'voltage4':i[5],'voltage5':i[6],
                                     'voltage6':i[7],'voltage7':i[8],'voltage8':i[9],'voltage9':i[10],'voltage10':i[11],'voltage11':i[12],
                                     'voltage12':i[13],'voltage13':i[14],'voltage14':i[15],'voltage15':i[16],'voltage16':i[17]})         
            else:
                result[i[1]] = [{'timestamp':polledTime,'voltage1':i[2],'voltage2':i[3],'voltage3':i[4],'voltage4':i[5],'voltage5':i[6],
                                     'voltage6':i[7],'voltage7':i[8],'voltage8':i[9],'voltage9':i[10],'voltage10':i[11],'voltage11':i[12],
                                     'voltage12':i[13],'voltage13':i[14],'voltage14':i[15],'voltage15':i[16],'voltage16':i[17]}]
    
    return [result]

@app.get('/Cygni/SlaveBatteryTemperature')
def peak_demand_date(db: mysql.connector.connect = Depends(get_emsdb)):
    try:
        ems_db = get_emsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    result = {}
    
    emscur = ems_db.cursor()

    emscur.execute("""select recorded_at,Utype,temp_1,temp_2,temp_3,temp_4,temp_5,temp_6
                      from Cygni.SlaveControls;""")
    
    res = emscur.fetchall()

    if len(res) > 0:
        for i in res:
            polledTime = str(i[0])
            if i[1] in result.keys():
                result[i[1]].append({'timestamp':polledTime,'temperature1':i[2],'temperature2':i[3],'temperature3':i[4],
                                     'temperature4':i[5],'temperature5':i[6],'temperature6':i[7]})
            else:
                result[i[1]] = [{'timestamp':polledTime,'temperature1':i[2],'temperature2':i[3],'temperature3':i[4],
                            'temperature4':i[5],'temperature5':i[6],'temperature6':i[7]}]

    return [result]

@app.get('/Cygni/MasterProperties')
def peak_demand_date(db: mysql.connector.connect = Depends(get_emsdb)):
    try:
        ems_db = get_emsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    result = {}
    
    emscur = ems_db.cursor()

    emscur.execute("""SELECT Total_battery_voltage,Total_current_of_the_battery_pack, SOC,
                      BMS_status, Charge_available_power, Discharge_available_power
                      FROM Cygni.MasterDevice_Properties limit 1;""")
    
    res = emscur.fetchall()

    if len(res) > 0:
        for i in res:
            result = {"TotalBatteryVoltage":i[0],"TotalBatteryCurrent":i[1],"SOC":i[2],"BMSstatus":i[3],
                      "ChargeAvailablePower":i[4],"DischargeAvailablePower":i[5]}

    return result 


@app.get('/Cygni/DeviceProperties')
def peak_demand_date(db: mysql.connector.connect = Depends(get_emsdb)):
    try:
        ems_db = get_emsdb()
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": f"MySQL connection error: {str(e)}"})
    
    result = {}
    
    emscur = ems_db.cursor()

    emscur.execute("""SELECT number_of_parallel_batteries,number_of_series_cells,soc,total_voltage,
                      max_temperature,min_temperature
                      FROM Cygni.Device_Properties limit 1;""")
    
    res = emscur.fetchall()

    if len(res) > 0:
        for i in res:
            result = {"numberOfParallelBatteries":i[0],"numberOfSeries":i[1],"SOC":i[2],"totalVoltage":i[3],
                      "maxTemperature":i[4],"minTemperature":i[5]}

    return result 


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=6000)
