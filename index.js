const express=require('express')
const timeout = require('connect-timeout')
const {con,chakradb,unprocesseddata,meterDb,EMSDB}=require('./connect')
const app=express()
const alert = express()
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const cors = require("cors");
const nodemailer = require('nodemailer');
const moment = require('moment-timezone');
const tz = 'Asia/Kolkata'
const password = "Arun@1807"
const email = 'arun.kumar@tenet.res.in'
const emailto =['ems@respark.iitm.ac.in']

const util = require('util');
const conQuery = util.promisify(EMSDB.query).bind(EMSDB);
const meterDataQuery=util.promisify(meterDb.query).bind(meterDb)
const chakradbQuery = util.promisify(chakradb.query).bind(chakradb);
const uploadDir = path.join(__dirname, 'uploads');
//faheera@respark.iitm.ac.in
// Multer configuration for file storage





const storage = multer.memoryStorage(); // Store file in memory
const upload = multer({ storage: storage });
 
alert.use(
    cors({
      origin: "*",
      credentials: true,
    })
  );

alert.use(express.json());

alert.use(timeout('40s'))




app.use(
    cors({
      origin: "*",
      credentials: true,
    })
  );

  app.use(express.json());
// function handleRequest() { }

//-------------------------------------------API`S for dashBoard-------------------------------------------------//

     //--------------------------------WheeledInSolar  Card api---------------------------------------------// 
     app.get("/WheeledInSolarCard",async(req,res)=>{
      meterDb.query("SELECT * FROM meterdata.metergeneration where date(metertimestamp)=curdate();",function(err,result,feilds){
        if(err){
          console.log(err)
          res.status(500).send("Internal Server Error");

        }
        else{
          const response=(JSON.parse(JSON.stringify(result)))
          res.status(200).send(response);
        }
      })

    })
   //-----------------------------------------end of api--------------------------------------------------//


      //--------------------------------RoofTopSolar  Card api---------------------------------------------// 
      app.get("/RoofTopSolarCard",async(req,res)=>{
        meterDb.query("SELECT * FROM meterdata.rooftopreadingtoday where date(polled_timestamp)=curdate();",function(err,result,feilds){
          if(err){
            console.log(err)
            res.status(500).send("Internal Server Error");
  
          }
          else{
            const response=(JSON.parse(JSON.stringify(result)))
            res.status(200).send(response);
          }
        })
  
      })
     //-----------------------------------------end of api--------------------------------------------------//

   //--------------------------------CO2REDUCTION  Card api---------------------------------------------// 
      app.get("/CO2REDUCTIONCard",async(req,res)=>{
        meterDb.query("SELECT * FROM meterdata.CO2REDUCTION where date(timestamps)=curdate() order by CO2REDUCTION desc limit 1;",function(err,result,feilds){
          if(err){
            console.log(err)
            res.status(500).send("Internal Server Error");

          }
          else{
            const response=(JSON.parse(JSON.stringify(result)))
            res.status(200).send(response);
          }
        })

      })
     //-----------------------------------------end of api--------------------------------------------------//


     //----------------------------------------------------------------------------------------------------//
     //----------------------chiller Dashboard phase2(1,2,3,4) api`s ----------------------------------------------//
  //-------------------------------thermal stored water temparature api-----------------------//
  app.get("/thermal/storedWaterTemp",async(req,res)=>{
    const thermalWaterTemp=[]
    meterDb.query("SELECT * FROM meterdata.thermalstoredwaterquaterly where date(timecolumn)=curdate()",function(error,result,feild){
      if(error){
        console.log(error)
      }
      else{
        const response=(JSON.parse(JSON.stringify(result)))
        for(let i=0;i<response.length;i++){
          let date=new Date(response[i].timecolumn)
          const hours = date.getHours().toString().padStart(2, '0');
     const minutes = date.getMinutes().toString().padStart(2, '0');
     // const seconds = date.getSeconds().toString().padStart(2, '0');
     const timestamp = `${hours}:${minutes}`;
     thermalWaterTemp.push({"polledTime":timestamp,"storedwatertemperature":parseFloat(response[i].storedwatertemperature)})


      }
      console.log(thermalWaterTemp)
        res.send(thermalWaterTemp)

        
      }
    })
  })
  //--------------------------------end of api----------------------------//


  //-----------------------------chiller Loading api-------------------------------//
  app.get("/chillerDashboard/ChillerLoading",async(req,res)=>{
    const ChillerLoadingData=[]
    meterDb.query("SELECT * FROM meterdata.chillarloading where date(lastTimestamp)=curdate()",function(error,result,feild){
      if(error){
        console.log(error)
      }
      else{
        const response=(JSON.parse(JSON.stringify(result)))
        for(let i=0;i<response.length;i++){
          let date=new Date(response[i].lastTimestamp)
          const hours = date.getHours().toString().padStart(2, '0');
     const minutes = date.getMinutes().toString().padStart(2, '0');
     // const seconds = date.getSeconds().toString().padStart(2, '0');
     const timestamp = `${hours}:${minutes}`;
     ChillerLoadingData.push({"polledTime":timestamp,"c1loading":parseFloat(response[i].c1loading),"c2loading":parseFloat(response[i].c2loading),"c3loading":parseFloat(response[i].c3loading),"c4loading":parseFloat(response[i].c4loading)})


      }
      console.log(ChillerLoadingData.length)
        res.send(ChillerLoadingData)

        
      }
    })
  })


//----------------------------END of chiller Loading api-------------------------------------//

//---------------------------------thermalinletoutlet (condenser and evaporator)-----------------------//

app.get("/chillerDashboard/thermalinletoutlet/condenser/evaporator",async(req,res)=>{
  const thermalinletoutletData=[]
  meterDb.query("SELECT * FROM thermalinletoutlet where date(Timestamp)=curdate()",function(error,result,feild){
    if(error){
      console.log(error)
    }
    else{
      const response=(JSON.parse(JSON.stringify(result)))
      for(let i=0;i<response.length;i++){
        let date=new Date(response[i].Timestamp)
        const hours = date.getHours().toString().padStart(2, '0');
   const minutes = date.getMinutes().toString().padStart(2, '0');
   // const seconds = date.getSeconds().toString().padStart(2, '0');
   const timestamp = `${hours}:${minutes}`;
   thermalinletoutletData.push({"polledTime":timestamp,"avg_commonHeaderinletTemp":parseFloat(response[i].avg_commonHeaderinletTemp),"avg_commonHeaderoutletTemp":parseFloat(response[i].avg_commonHeaderoutletTemp),"avg_condenserLineInletTemp":parseFloat(response[i].avg_condenserLineInletTemp),"avg_condenserLineOutletTemp":parseFloat(response[i].avg_condenserLineOutletTemp),"avg_commonHeaderFlowrate":parseFloat(response[i].avg_commonHeaderFlowrate),"avg_condenserLineFlowrate":parseFloat(response[i].avg_condenserLineFlowrate)})


    }
    console.log(thermalinletoutletData.length)
      res.send(thermalinletoutletData)

      
    }
  })
})

//-------------------------------END of thermalinletoutlet (condenser and evaporator) api---------------------------------//

//---------------------------------Average of C1 cop to C4 cop--------------------------------------//
app.get("/chillerDashboard/Average/chillarCOP",async(req,res)=>{
  const chillarCOP=[]
  meterDb.query("SELECT * FROM meterdata.chillarcop where date(timestamp)=curdate();",function(error,result,feild){
    if(error){
      console.log(error)
    }
    else{
      const response=(JSON.parse(JSON.stringify(result)))
      for(let i=0;i<response.length;i++){
        let date=new Date(response[i].timestamp)
        const hours = date.getHours().toString().padStart(2, '0');
   const minutes = date.getMinutes().toString().padStart(2, '0');
   // const seconds = date.getSeconds().toString().padStart(2, '0');
   const timestamp = `${hours}:${minutes}`;
   chillarCOP.push({"polledTime":timestamp,"avg_c1cop":parseFloat(response[i].c1cop),"avg_c2cop":parseFloat(response[i].c2cop),"avg_c3cop":parseFloat(response[i].c3cop),"avg_c4cop":parseFloat(response[i].c4cop)})


    }
    console.log(chillarCOP.length)
      res.send(chillarCOP)

      
    }
  })
})

//----------------------------END of Average of C1 cop to C4 cop---------------------------------------//

//-------------------------------total Cooling of the day api--------------------------------------------//
app.get("/chillerDashboard/TotalCoolingEnergy",async(req,res)=>{
  const ChillerTotalCooling=[]
  meterDb.query("SELECT * FROM meterdata.phase2tR where date(timestamp)=curdate();",function(error,result,feild){
    if(error){
      console.log(error)
    }
    else{
      const response=(JSON.parse(JSON.stringify(result)))
      for(let i=0;i<response.length;i++){
        let date=new Date(response[i].timestamp)
        const hours = date.getHours().toString().padStart(2, '0');
   const minutes = date.getMinutes().toString().padStart(2, '0');
   // const seconds = date.getSeconds().toString().padStart(2, '0');
   const timestamp = `${hours}:${minutes}`;
   ChillerTotalCooling.push({"polledTime":timestamp,"TotalCoolingEnergy":Math.trunc(response[i].totalenergy)})


    }
    console.log(ChillerTotalCooling.length)
      res.send(ChillerTotalCooling)

      
    }
  })
})
//---------------------------------end of total Cooling of the day ---------------------------------------//


  //----------------------------------------END of chillerDashboard api`s ----------------------------//

     //------------------------------------------------end of phase 2(1,2,3,4)-----------------------------------------------------//
          


//----------------------------------end of API`S-------------------------------------------------------------------//

    app.get("/inverter",async(req,res)=>{
        con.query("SELECT * FROM EMSInverterData WHERE invertertimestamp >= CURDATE() AND invertertimestamp < DATE_ADD(CURDATE(), INTERVAL 1 DAY)",function(err,result,feilds){
            if(err){
                console.log(err)
            }
            else{
                const response=(JSON.parse(JSON.stringify(result)))
                res.send(response)
                console.log(response.length)
            }
        })
        
    })

    app.get("/wms",async(req,res)=>{
        con.query("SELECT * FROM EMSWMSData WHERE wmstimestamp >= CURDATE() AND wmstimestamp < DATE_ADD(CURDATE(), INTERVAL 1 DAY) order by wmstimestamp desc",function(err,result,feilds){
            if(err){
                console.log(err)
            }
            else{
                const response=(JSON.parse(JSON.stringify(result)))
                res.send(response)
                console.log(response.length)
            }
        })
        
    })

    app.get("/meterdata",async(req,res)=>{
      con.query("select sum(Energy) as SolarEnergy from Wheeledhourly where date(polledTime) = curdate();",function(err,result,feilds){
          if(err){
              console.log(err)
          }
          else{
              const response=(JSON.parse(JSON.stringify(result)))
              res.send(response)
              console.log(response.length)
          }
      })
})

    
    
    app.get("/battery",async(req,res)=>{
        con.query("SELECT * FROM EMSUPSbattery WHERE received_time >= CURDATE() AND received_time < DATE_ADD(CURDATE(), INTERVAL 1 DAY) ",function(err,result,feilds){
            if(err){
                console.log(err)
            }
            else{
                const response=(JSON.parse(JSON.stringify(result)))
                //res.send(response)

                // for(const i of response){
                //     console.log((i.received_time))
                //     const utcTimeString =i.received_time
                //     const date = new Date(utcTimeString)
                //     const localTimeString = date.toLocaleString();
                //     const minutes = date.getUTCMinutes();
                //     console.log(minutes);
                //     console.log(localTimeString)
                // }
                
                // console.log(response.length)
                const emptyArray=[]
                let data = []; // array to store the data

// Assuming each data point has a timestamp property in ISO format and a value property
let groupedData = response.reduce((accumulator, currentValue) => {
  let timestamp = new Date(currentValue.received_time);
  let hour = timestamp.getHours();
  let minute = timestamp.getMinutes();
  let date=timestamp.getDate()
  let month=timestamp.getMonth()
  let year=timestamp.getFullYear()
  let timeKey = `${hour}:${minute}`;

  if (!accumulator[timeKey]) {
    accumulator[timeKey] = {
      chargingenergy: [],
      dischargingenergy:[],
      pack_usable_soc:[],
      count: 0,
      chargingenergyaverage:0,
      dischargingenergyavg:0,
      packsoc:0,
      batterystaus:'',
      timestamp:[]

    };
  }

  accumulator[timeKey].chargingenergy.push(currentValue.upschargingenergy);
  accumulator[timeKey].dischargingenergy.push(currentValue.negative_energy);
  accumulator[timeKey].pack_usable_soc.push(currentValue.pack_usable_soc);
  accumulator[timeKey].count++;
             // taking average of chargingenergy
  let chargingenergysum = accumulator[timeKey].chargingenergy.reduce((acc, val) => acc + val, 0);
  let chargingenergyavg=chargingenergysum / accumulator[timeKey].chargingenergy.length;
  accumulator[timeKey].chargingenergyaverage=chargingenergyavg

  accumulator[timeKey].timestamp.push(currentValue.received_time)
     
            // taking average of dischargingenergy 
  let dischargingsum=accumulator[timeKey].dischargingenergy.reduce((acc, val) => acc + val, 0);
  let dischargingenergyavg=dischargingsum/accumulator[timeKey].dischargingenergy.length;
  accumulator[timeKey].dischargingenergyavg=dischargingenergyavg

            //taking average of pack soc
 let packsocsum=accumulator[timeKey].pack_usable_soc.reduce((acc, val) => acc + val, 0);
 let packsocavg=packsocsum/accumulator[timeKey].pack_usable_soc.length;
accumulator[timeKey].packsoc=packsocavg

  accumulator[timeKey].batterystaus=currentValue.upsbatterystatus
  //console.log(avg)

  return accumulator;
}, {});


emptyArray.push(groupedData)
//res.send(emptyArray)
const minresult=[]
//looping through the gruped
emptyArray.forEach(obj => {
    for (const key in obj) {
        const chargingEnergyAvg = obj[key].chargingenergyaverage;
        const dischargingenergy=obj[key].dischargingenergyavg;
        const batterystaus=obj[key].batterystaus;
        const packSoc=obj[key].packsoc;
        const timestamp=obj[key].timestamp[0];
        const date = new Date(timestamp)
       const localTimeString = date.toLocaleString();

        minresult.push({'chargingAVG':chargingEnergyAvg,"dischargingAVG":dischargingenergy,"batteryStatus":batterystaus,"timestamp":date,"pack_usable_soc":packSoc})
    }
  });
  
  const finalresult=[]
  const calculated=[]
  for (let i = 1; i < minresult.length; i++) {
    const minituesdata=minresult.slice(i,i+15)

      const call=minresult.slice(i,i+15).reduce(
        (accumulator, currentValue) => accumulator+currentValue.dischargingAVG,
        0
      );
      //const avg=call/minituesdata.length
      //console.log(minituesdata.length)

    finalresult.push(minituesdata)
    calculated.push(call)

    // const current = minresult[i];
    // const previous = minresult[i - 1];
    // const chargingDiff = current.chargingAVG - previous.chargingAVG;
    // const dischargingDiff = current.dischargingAVG - previous.dischargingAVG;
    // const timestamp=minresult[i].timestamp
    // const packSocVal=minresult[i].pack_usable_soc
    // const batteryStatus=minresult[i].batteryStatus
    // finalresult.push({'chargingEnergy':chargingDiff,'dischargingEnergy':dischargingDiff,"timestamp":timestamp,"pack_usable_soc":packSocVal,"batteryStatus":batteryStatus})
    // console.log(`Charging difference: ${chargingDiff}`);
    // console.log(`Discharging difference: ${dischargingDiff}`);
  }
  //console.log(calculated)
  res.send(minresult)
  //res.send(finalresult)








                // for(let i=0;i<response.length;i++){
                //     if(response[i].upsbatterystatus==="CHG"){
                //         emptyArray.push(response[i].upschargingenergy)
                //     }
                //     else if(response[i].upsbatterystatus==="DCHG"){
                //         emptyArray.push(response[i].negative_energy)
                //     }
                //     else if(response[i].upsbatterystatus==="IDLE"){
                //         emptyArray.push(0)
                //     }
                // }
            // console.log(emptyArray)
            // res.send(emptyArray)
                //SELECT HOUR(received_time) AS hour, AVG(upschargingenergy) AS chargingenergy, AVG(upsdischargingenergy) AS discharging, AVG(packsoc) AS packsoc FROM EMSUPSbattery WHERE DATE(received_time) = CURDATE() GROUP BY HOUR(received_time) 
            }
        })
        
    })

  app.get("/Batterydata",async(req,res)=>{
    const finalresultValue=[]
    EMSDB.query("select * from EMSUPSbattery where date(received_time)=curdate();",function(err,result,feilds){
      if(err){
        console.log(err)
      }
      else{
        const response=(JSON.parse(JSON.stringify(result)))
        for(let i=0;i<response.length;i++){
          const date = new Date(response[i].received_time)
          const localTimeString = date.toLocaleString();
          finalresultValue.push({'chargingAVG':response[i].upschargingenergy,"dischargingAVG":response[i].negative_energy,"batteryStatus":response[i].upsbatterystatus,"timestamp":localTimeString,"pack_usable_soc":response[i].packsoc,"BatteryCurrent":response[i].batterycurrent,"BatteryVoltage":response[i].batteryvoltage})

        }
        res.send(finalresultValue)
        console.log(finalresultValue.length)
      }

    })
   
  })



    //---------------------------battery Dashboard--------------------//
    app.get("/dashboard/Battery",async(req,res)=>{
      const resultValue=[]
      let  IdleState=0
      con.query("select * from UPSbatteryHourly where date(polledTime) = curdate();",function(err,result,feilds){
       // DATE_SUB(CURDATE(), INTERVAL 1 DAY)  
        if(err){
              console.log(err)
          }
          else{
              const response=(JSON.parse(JSON.stringify(result)))
              for(let i=0;i<response.length;i++){
                let date = new Date(response[i].polledTime);
                const hours = date.getHours().toString().padStart(2, '0');
                const minutes = date.getMinutes().toString().padStart(2, '0');
                // const seconds = date.getSeconds().toString().padStart(2, '0');
                const timestamp = `${hours}:${minutes}`;
                if((response[i].chargingEnergy==null || response[i].chargingEnergy===0) && (response[i].discharhingEnergy==null || response[i].discharhingEnergy===0) ){
                  IdleState=parseFloat(0.1)
                }

                resultValue.push({"PolledTime":timestamp,"chargingEnergy":parseFloat(response[i].chargingEnergy),"dischargingEnergy":parseFloat(response[i].discharhingEnergy),"idleEnergy":IdleState,"Pacsoc":parseInt(response[i].packsoc),"energy_available":response[i].energyAvailable})

              }
              res.send(resultValue)
              console.log(resultValue.length)
          }
      })
      
  })



    //-----------------------end of api---------------------//


    //----------------------------dashboard battery  filtered graph api---------------------------------//
    app.post("/dashboard/filtered/Battery",async(req,res)=>{
      const {date}=req.body
      const resultValue=[]
      let  IdleState=0
      con.query(`select * from UPSbatteryHourly where date(polledTime) = '${date}'`,function(err,result,feilds){
       // DATE_SUB(CURDATE(), INTERVAL 1 DAY)  
        if(err){
              console.log(err)
          }
          else{
              const response=(JSON.parse(JSON.stringify(result)))
              for(let i=0;i<response.length;i++){
                let date = new Date(response[i].polledTime);
                const hours = date.getHours().toString().padStart(2, '0');
                const minutes = date.getMinutes().toString().padStart(2, '0');
                // const seconds = date.getSeconds().toString().padStart(2, '0');
                const timestamp = `${hours}:${minutes}`;
                if((response[i].chargingEnergy==null || response[i].chargingEnergy===0) && (response[i].discharhingEnergy==null || response[i].discharhingEnergy===0) ){
                  IdleState=parseFloat(0.1)
                }
                else{
                  IdleState=parseInt(0)
                }
                resultValue.push({"PolledTime":timestamp,"chargingEnergy":parseFloat(response[i].chargingEnergy),"dischargingEnergy":parseFloat(response[i].discharhingEnergy),"idleEnergy":IdleState,"Pacsoc":parseInt(response[i].packsoc),"energy_available":response[i].energyAvailable})

              }
              res.send(resultValue)
              console.log(resultValue.length)
          }
      })
      
  })
  //---------------------------------------end of api---------------------------------------------------------//

    //SELECT * FROM EMSUPSbattery WHERE upstimestamp >= CURDATE() AND upstimestamp < DATE_ADD(CURDATE(), INTERVAL 1 DAY) order by upstimestamp desc

    app.get("/sollar",async(req,res)=>{
        chakradb.query(" select * from buildingHourwiseEnergyUsage where date >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)  AND date < CURDATE() AND name IN ('IITMRP', 'Tirunelveli')",function(err,result,feilds){
            if(err){
                console.log(err)
            }
            else{
                const response=(JSON.parse(JSON.stringify(result)))
                res.send(response)
                console.log(response.length)
            }
        })
        
    })

    app.get("/solarPerformance",async(req,res)=>{
        chakradb.query("SELECT * FROM solarPerformanceQuarterHourly  WHERE time >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)  AND time < CURDATE() AND subSystemId=1147 ",function(err,result,feilds){
            if(err){
                console.log(err)
            }
            else{
                const response=(JSON.parse(JSON.stringify(result)))
                res.send(response)
                console.log(response.length)
            }
        })
        
    })

    app.get("/sensorreadings",async(req,res)=>{
        unprocesseddata.query("SELECT * FROM sensorreadings WHERE sensorpolledtimestamp >= CURDATE() AND sensorpolledtimestamp < DATE_ADD(CURDATE(), INTERVAL 1 DAY) order by sensorpolledtimestamp desc ",function(err,result,feilds){
            if(err){
                console.log(err)
            }
            else{
                const response=(JSON.parse(JSON.stringify(result)))
                res.send(response)
                console.log(response.length)
            }
        })
        
    })


    app.get("/acmeterenergy",async(req,res)=>{
        unprocesseddata.query("select * from acmeterreadings WHERE acmeterpolledtimestamp >= CURDATE() AND acmeterpolledtimestamp < DATE_ADD(CURDATE(), INTERVAL 1 DAY) AND acmetersubsystemid IN (1035,1147) ",function(err,result,feilds){
            if(err){
                console.log(err)
            }
            else{
                const response=(JSON.parse(JSON.stringify(result)))
                res.send(response)
                console.log(response.length)
            }
        })
        
    })

    app.get("/grid",async(req,res)=>{
      let Value=[]
      meterDb.query("select sum(Energy) as cumulative_energy, polledTime as polled_timestamp from EMS.Gridhourly where date(polledTime) = curdate();",function(err,result,feilds){
             if(err){
                 console.log(err)
             }
             else{
                 const response=(JSON.parse(JSON.stringify(result)))

                 
                  for(let i=0;i<response.length;i++){
                    const TimeStamp=new Date(response[i].polled_timestamp)
                   const TimeResult=TimeStamp.toLocaleString()
                  }
                 
                 res.send(response)
                 console.log(response.length)
             }
         })

 
        
    })

    app.get("/Buildingconsumption/grid",async(req,res)=>{
      const resultValue=[]
      meterDb.query("select cumulative_energy,timestamp from gridenergyhourly where date(timestamp)=curdate() ",function(err,result,feilds){
             if(err){
                 console.log(err)
             }
             else{
                 const response=(JSON.parse(JSON.stringify(result)))
                 for(let i=0;i<response.length;i++){
                  let date = new Date(response[i].timestamp);
              const hours = date.getHours().toString().padStart(2, '0');
              const minutes = date.getMinutes().toString().padStart(2, '0');
              // const seconds = date.getSeconds().toString().padStart(2, '0');
              const timestampVal = `${hours}:${minutes}`;
              resultValue.push({"polledTime":timestampVal,"cumulative_energy":parseFloat(response[i].cumulative_energy)})

                 }
                 res.send(resultValue)
                 console.log(response.length)
             }
         })

 
        
    })
    
//-------------------building consumption system overview api-------------------------------//
    app.get('/BuildingConsumptionPage2',async(req,res)=>{
      const finalValue=[]
      con.query("SELECT * FROM buildingConsumption  where date(polledTime) = curdate();",function(err,result,feilds){
        //DATE_SUB(CURDATE(), INTERVAL 1 DAY)
        
        //SELECT Gridhourly.Energy as GridEnergy, Gridhourly.polledTime as timestamp, rooftopHourly.energy as RooftopEnergy , UPSbatteryHourly.discharhingEnergy as BatteryDischarEnergy, chargingEnergy as BatteryChargeEnergy,Wheeledhourly.Energy as WheeledEnergy FROM Gridhourly JOIN rooftopHourly ON Gridhourly.polledTime = rooftopHourly.polledTime JOIN UPSbatteryHourly ON rooftopHourly.polledTime = UPSbatteryHourly.polledTime JOIN Wheeledhourly ON Wheeledhourly.polledTime=rooftopHourly.polledTime  where date(Gridhourly.polledTime)=CURDATE();
        if(err){
          console.log(err)
        }
        else{
          const response=(JSON.parse(JSON.stringify(result)))
          for(let i=0;i<response.length;i++){
            let date = new Date(response[i].polledTime);
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            // const seconds = date.getSeconds().toString().padStart(2, '0');
            const timestampVal = `${hours}:${minutes}`;
            finalValue.push({"Timestamp":timestampVal,"GridEnergy":Math.trunc(response[i].gridEnergy),"RooftopEnergy":Math.trunc(response[i].rooftopEnergy),"BatteryDischarEnergy":response[i].BatteryDischarEnergy,"BatteryChargeEnergy":response[i].BatteryChargeEnergy,"WheeledInSolar":Math.round(response[i].wheeledinEnergy),"thermalDischarge":parseInt(response[i].thermalDischarge)*-1})
            
          }
          res.send(finalValue)
           console.log(response.length)

        }
      })
    })
    //---------------------------------------END   OF API -----------------------------------------------------//


    //---------- building consumption system overview filtered graph api -----------------------------------//
    app.post('/filteredGraph/BuildingConsumptionPage2',async(req,res)=>{
      const {date}=req.body
      const finalValue=[]
      con.query(`SELECT * FROM buildingConsumption  where date(polledTime) = '${date}'`,function(err,result,feilds){
        //DATE_SUB(CURDATE(), INTERVAL 1 DAY)
        
        //SELECT Gridhourly.Energy as GridEnergy, Gridhourly.polledTime as timestamp, rooftopHourly.energy as RooftopEnergy , UPSbatteryHourly.discharhingEnergy as BatteryDischarEnergy, chargingEnergy as BatteryChargeEnergy,Wheeledhourly.Energy as WheeledEnergy FROM Gridhourly JOIN rooftopHourly ON Gridhourly.polledTime = rooftopHourly.polledTime JOIN UPSbatteryHourly ON rooftopHourly.polledTime = UPSbatteryHourly.polledTime JOIN Wheeledhourly ON Wheeledhourly.polledTime=rooftopHourly.polledTime  where date(Gridhourly.polledTime)=CURDATE();
        if(err){
          console.log(err)
        }
        else{
          const response=(JSON.parse(JSON.stringify(result)))
          for(let i=0;i<response.length;i++){
            let date = new Date(response[i].polledTime);
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            // const seconds = date.getSeconds().toString().padStart(2, '0');
            const timestampVal = `${hours}:${minutes}`;
            finalValue.push({"Timestamp":timestampVal,"GridEnergy":Math.trunc(response[i].gridEnergy),"RooftopEnergy":Math.trunc(response[i].rooftopEnergy),"BatteryDischarEnergy":response[i].BatteryDischarEnergy,"BatteryChargeEnergy":response[i].BatteryChargeEnergy,"WheeledInSolar":Math.round(response[i].wheeledinEnergy),"thermalDischarge":parseInt(response[i].thermalDischarge)*-1})
            
          }
          res.send(finalValue)
           console.log(response.length)

        }
      })
    })
    //------------------------END of API---------------------------------------------------//


    




    // app.get("/db",async(req,res)=>{ })
    // unprocesseddata.query("show tables",function(err,result,feilds){
    //         if(err){
    //             console.log(err)
    //         }
    //         else{
    //             // const response=(JSON.parse(JSON.stringify(result)))
    //             // res.send(response)
    //             console.log(result)
    //         }
    //     })



        // function sendEmail(emailRecipient, value) {
        //     const transporter = nodemailer.createTransport({
        //       host: 'smtp.example.com',
        //       port: 587,
        //       secure: false,
        //       auth: {
        //         user: 'ganeshkalyan506@gmail.com',
        //         pass: 'Ganesh3110#',
        //       },
        //     });
          
        //     const info = transporter.sendMail({
        //       from: 'ganeshkalyan506@gmail.com',
        //       to: 'ganeshr@tenet.res.in',
        //       subject: 'Threshold Exceeded',
        //       text: `The value  has exceeded the threshold of 4000 kVA.`,
        //     });
          
        //     console.log('Email sent: ' + info.response);
        //   }


        //   sendEmail()

        //   var transporter = nodemailer.createTransport({
        //     service: 'gmail',
        //     auth: {
        //       user: 'arunkumar183107@gmail.com',
        //       pass: 'Arun@280196'
        //     }
        //   });
          
        //   var mailOptions = {
        //     from: 'arunkumar183107@gmail.com',
        //     to: 'ganeshkalyan506@gmail.com',
        //     subject: 'Sending Email using Node.js',
        //     text: 'That was easy!'
        //   };
          
          
        //   transporter.sendMail(mailOptions, function(error, info){
        //     if (error) {
        //       console.log(error);
        //     } else {
        //       console.log('Email sent: ' + info.response);
        //     }
        //   });

        // const transporter = nodemailer.createTransport({
        //     host: 'smtp.office365.com',
        //     port: 587,
        //     secure: false,
        //     auth: {
        //       user: 'ganeshr@tenet.res.in',
        //       pass: 'Ganesh3110#'
        //     }
        //   });
          
        //   const mailOptions = {
        //     from: 'ganeshr@tenet.res.in',
        //     to: 'arun.kumar@tenet.res.in',
        //     subject: 'Test email',
        //     html: '<h1 >Warning:-Peak Demand has crossed limit of 4000kVA</h1>'
        //   };
          
        //   transporter.sendMail(mailOptions, function(error, info) {
        //     if (error) {
        //       console.log(error);
        //     } else {
        //       console.log('Email sent: ' + info.response);
        //     }
        //   });

        

// ----------------------------------------------------------------------------------------------------------------------------------------

        // -------------------------thermal dashboard api for initial graph--------------------------------//
        app.get("/thermal", (req,res)=>{
            // let c = 0
            // let chk = 0
            // const timarr = []
            // var output = []
            con.query(`select coolingEnergy,timeInHour from ThermalStorageProcessed where DATE(recordTime) = curdate()`,function(err,result){
                var output = {"0":{chillerEnergy: 0},"1":{chillerEnergy: 0},"2":{chillerEnergy: 0},"3":{chillerEnergy: 0},"4":{chillerEnergy: 0},"5":{chillerEnergy: 0},"6":{chillerEnergy: 0},"7":{chillerEnergy: 0},"8":{chillerEnergy: 0},"9":{chillerEnergy: 0},"10":{chillerEnergy: 0},"11":{chillerEnergy: 0},"12":{chillerEnergy: 0},"13":{chillerEnergy: 0},"14":{chillerEnergy: 0},"15":{chillerEnergy: 0},"16":{chillerEnergy: 0},"17":{chillerEnergy: 0},"18":{chillerEnergy: 0},"19":{chillerEnergy: 0},"20":{chillerEnergy: 0},"21":{chillerEnergy: 0},"22":{chillerEnergy: 0},"23":{chillerEnergy: 0}}
                if(err){
                    console.log(err)
                }else{
                    for (const res of result){
                        output[res.timeInHour] = {"chillerEnergy":res.coolingEnergy}
                    }
                }
                console.log(output)
                res.send(output)
            })

        })
        //----------------------------- end of api --------------------------------------------//

        // ------------------thermal dashboard api  for date filter api -------------------------------//
        app.post("/thermal/datefilter", (req,res)=>{
          const {date}=req.body
          console.log(date)
          // let c = 0
          // let chk = 0
          // const timarr = []
          // var output = []
          con.query(`select coolingEnergy,timeInHour from ThermalStorageProcessed where DATE(recordTime) = '${date}'`,function(err,result){
              var output = {"0":{chillerEnergy: 0},"1":{chillerEnergy: 0},"2":{chillerEnergy: 0},"3":{chillerEnergy: 0},"4":{chillerEnergy: 0},"5":{chillerEnergy: 0},"6":{chillerEnergy: 0},"7":{chillerEnergy: 0},"8":{chillerEnergy: 0},"9":{chillerEnergy: 0},"10":{chillerEnergy: 0},"11":{chillerEnergy: 0},"12":{chillerEnergy: 0},"13":{chillerEnergy: 0},"14":{chillerEnergy: 0},"15":{chillerEnergy: 0},"16":{chillerEnergy: 0},"17":{chillerEnergy: 0},"18":{chillerEnergy: 0},"19":{chillerEnergy: 0},"20":{chillerEnergy: 0},"21":{chillerEnergy: 0},"22":{chillerEnergy: 0},"23":{chillerEnergy: 0}}
              if(err){
                  console.log(err)
              }else{
                  for (const res of result){
                      output[res.timeInHour] = {"chillerEnergy":res.coolingEnergy}
                  }
              }
              console.log(output)
              res.send(output)
          })

      })
        //-------------------end of api----------------------------------//

        //------------------------Thermal quaterly graph api---------------------------//
        app.get("/thermalquarter", (req,res)=>{
          const {date}=req.body
          console.log(date)
          const finalValue=[]

          con.query('select polledTime,coolingEnergy from EMS.ThermalQuarter where date(polledTime) = curdate()',function(err,result){
            if (err){
              console.log(err)
            }
            else{

              const response=(JSON.parse(JSON.stringify(result)))
          for(let i=0;i<response.length;i++){
            let date = new Date(response[i].polledTime);
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            // const seconds = date.getSeconds().toString().padStart(2, '0');
            const timestampVal = `${hours}:${minutes}`;
            finalValue.push({"TimeStamp":timestampVal,"coolingEnergy":parseFloat((response[i].coolingEnergy)*-1),"ChargingEnergy": response[i].ChargingEnergy == null ? 0 : parseFloat((response[i].ChargingEnergy))})
           
          }
              console.log(finalValue)
              res.send(finalValue)
            }
          })

        })
        //------------------------------  END of api------------------------------------// 


        //-----------------------------Thermal  quaterly Date Filter  garph api------------------------//
        app.post("/thermalquarter/datefilter", (req,res)=>{
          const {date}=req.body
          console.log(date)
          const finalValue=[]

          con.query(`select polledTime,coolingEnergy from EMS.ThermalQuarter where date(polledTime) = '${date}'`,function(err,result){
            if (err){
              console.log(err)
            }
            else{
              const response=(JSON.parse(JSON.stringify(result)))
              for(let i=0;i<response.length;i++){
                let date = new Date(response[i].polledTime);
                const hours = date.getHours().toString().padStart(2, '0');
                const minutes = date.getMinutes().toString().padStart(2, '0');
                // const seconds = date.getSeconds().toString().padStart(2, '0');
                const timestampVal = `${hours}:${minutes}`;
                finalValue.push({"TimeStamp":timestampVal,"coolingEnergy":parseFloat((response[i].coolingEnergy)*-1),"ChargingEnergy": response[i].ChargingEnergy == null ? 0 : parseFloat((response[i].ChargingEnergy))})
               
              }
              console.log(finalValue)
              res.send(finalValue)
            }

        })

      })
        //----------------------------------- END of api -----------------------------------------------//

        
        // thermal Temp api
        app.get("/thermaltemp", (req,res)=>{
            unprocesseddata.query(`select tsStoredWaterTemperature from bmsmgmtprodv13.thermalStorageMQTTReadings where Date(polledTime) = curdate() order by polledTime desc LIMIT 1;`,function(err,querres){
                let tempera = 0
                if(err){
                    console.log(err)
                }else{
                    temp = JSON.parse(JSON.stringify(querres))
                    for (const tempdata of temp){
                        // console.log("temp : ",tempdata.tsStoredWaterTemperature/100)
                        tempera = (tempdata.tsStoredWaterTemperature/100)
                    }
                    res.send(tempera.toFixed(1))
                }
            })
           
        })


// ----------------------------------------------------------------------------------------------------------------------------------

        // rooftop
        app.get("/rooftop",(req,res)=>{
            var rooftop = 0 
            meterDb.query("select cumulative_energy,polled_timestamp from meterdata.rooftopreadingtoday where Date(polled_timestamp)=curdate() order by polled_timestamp desc limit 1;",function(err,qrres){
                if(err){
                    console.log(err)
                }else{
                    for (const result of qrres){
                        rooftop = result["cumulative_energy"]
                    }
                }
                res.send([rooftop])
                console.log(rooftop)
            })
        })


//------------------------------------------------------------------------------------------------------------------------------------
    
        // Peak shavings
        app.get('/peaksavings',(req,res)=>{
            con.query(`select Energysaved from energySaved where date(polledTime) = curdate()`,function(err,qres){
                var energysaved = 0
                if(err){
                    console.log(err)
                }else{
                    for (const result of qres){
                        energysaved = result["Energysaved"]
                    }
                console.log("Energysaved ",energysaved)
                res.send([energysaved])
                }
            })
        })

//--------------------------------------------------------------------------------------------------------------------------------------

            // Chiller status
        
            app.get("/chillerstatusd",(req,res)=>{
                chakradb.query(`select chiller1Power,chiller2Power,chiller3Power,chiller4Power,polledTime from hvacChillerElectricPolling order by polledTime desc LIMIT 1`,function(err,qres){
                    if(err){
                        console.log(err)
                    }else{
                        outli = []
                        for(const out of qres){
                            outli.push(out["chiller1Power"])
                            outli.push(out["chiller2Power"])
                            outli.push(out["chiller3Power"])
                            outli.push(out["chiller4Power"])
                        }
                        res.send(outli)
                    }
                })
            })

            app.get("/chillerstatuse",(req,res)=>{
                unprocesseddata.query(`select FLOOR(acmeterenergy),acmeterpower,acmeterpolledtimestamp,acmetersubsystemid from acmeterreadings where acmetersubsystemid in(1442,1163,1441,1494) order by acmeterpolledtimestamp desc limit 4;`,function(err,qres){
                    if(err){
                        console.log(err)
                    }else{
                        outl = {}
                        for(const out of qres){
                            if (out["acmetersubsystemid"] == 1442){
                                outl['chiller5']=out['acmeterpower']
                            }
                            else if (out["acmetersubsystemid"] == 1163){
                                outl['chiller6']=out['acmeterpower']
                            }
                            else if (out["acmetersubsystemid"] == 1441){
                                outl["chiller7"]=out['acmeterpower']
                            }
                            else if (out["acmetersubsystemid"] == 1494){
                                outl["chiller8"]=out['acmeterpower']
                            }
                        }
                        // console.log(outl)
                        res.send(outl)
                    }
                })
            })
            
            
            
            
//             app.get("/schneider7230readings",async(req,res)=>{
//     meterDb.query("select * from schneider7230readings  where DATE(schneiderpolledtimestamp) = curdate()  order by schneiderpolledtimestamp desc limit 1",function(err,result,feilds){
//         const powerfactor=[]
//         if(err){
//             console.log(err)
//         }
//         else{
//             const response=(JSON.parse(JSON.stringify(result)))
//             for(let i=0;i<response.length;i++){
//             const date = new Date(response[i].schneiderpolledtimestamp);
//             const timestamp = date.toLocaleString();
//             powerfactor.push({"polledTime":timestamp,"average_powerfactor":response[i].average_powerfactor,"minimum_powerfactor":response[i].minimum_powerfactor})
//             }
//             res.send(powerfactor)
//             console.log(powerfactor)
//         }
//     })
   
// })

app.get("/schneider7230readings",async(req,res)=>{
  meterDb.query("select * from schneider7230readings  where DATE(schneiderpolledtimestamp) = curdate()  order by schneiderpolledtimestamp desc limit 1",function(err,result,feilds){
      const powerfactor=[]
      if(err){
          console.log(err)
      }
      else{
          const response=(JSON.parse(JSON.stringify(result)))
          for(let i=0;i<response.length;i++){
          const date = new Date(response[i].schneiderpolledtimestamp);
          const timestamp = date.toLocaleString();
          powerfactor.push({"polledTime":timestamp,"average_powerfactor":response[i].average_powerfactor,"minimum_powerfactor":response[i].minimum_powerfactor})
          }
          res.send(powerfactor)
          console.log(powerfactor)
      }
  })
 
})


//------------------ diselenergy api-------------------------//
app.get("/dashboard/Deisel",async(req,res)=>{
    meterDb.query("SELECT * FROM diselenergy where date(polled_time)=curdate() order by polled_time desc limit 1",function(error,result){
        const deiseldata=[]
        if(error){
            console.log(error)
        }
        else{
            const response=(JSON.parse(JSON.stringify(result)))
            console.log(response)
            res.send(response)

        }

    })
})


//--------------------Ev charger card api--------------------//
app.get("/dashboard/EvCharger",async(req,res)=>{
  con.query("select * from evcharger where date(servertime)=curdate();",function(error,result){
      //select * from evcharger where date(servertime)=curdate()
      //SELECT * FROM evcharger WHERE DATE(servertime) = DATE_SUB(CURDATE(), INTERVAL 1 DAY);
      const LEV1_1=[]
      const LEV4_1=[]
      const CP11_1=[]
      const CP12_1=[]
      const CP13_1=[]
      const CP14_1=[]
      const energyValue=[]

      let resultval=0
      if(error){
          console.log(error)
      }
      else{
          const response=(JSON.parse(JSON.stringify(result)))
let LEV1_1= {'LEV1_1Energy':0,'LEV1_1TotalSession':0,'LEV1_1NoOf_chargers':0} 
let LEV4_1= {'LEV4_1Energy':0,'LEV4_1TotalSession':0,'LEV4_NoOf_chargers':0}
let CP11_1= {'CP11_1Energy':0,'CP11_1TotalSession':0,'CP11_1NoOf_chargers':0}
let CP12_1= {'CP12_1Energy':0,'CP12_1TotalSession':0,'CP12_1NoOf_chargers':0}
let CP13_1= {'CP13_11Energy':0,'CP13_1TotalSession':0,'CP13_1NoOf_chargers':0}
let CP14_1= {'CP14_1Energy':0,'CP14_1TotalSession':0,'CP14_1NoOf_chargers':0}

let NoOfChargers=0
let previousTimestamp = null;
let totalUsageTime = 0;
let LEV1_1Status=""
let LEV4_1Status=""
let CP11_1Status=""
let CP12_1Status=""
let CP13_1Status=""
let CP14_1Status=""



for(let i=0;i<response.length;i++){
  
  if(response[i].chargpointname==="LEV1_1"){
      LEV1_1.LEV1_1Energy+=parseFloat(response[i].energyconsumption)
       LEV1_1.LEV1_1TotalSession=(response[i].totalsessions)
       if(parseFloat(response[i].energyconsumption)>0){
          LEV1_1.LEV1_1NoOf_chargers="Active"
          LEV1_1Status=("active")
          NoOfChargers+=1
       }
       if (response[i].totalsessions === 1) {
          if (previousTimestamp) {
            const currentTimestamp = new Date(response[i].servertime);
            const timeDifference = currentTimestamp - previousTimestamp;
            console.log(timeDifference)
            console.log(response[i].chargpointname)
            totalUsageTime += timeDifference;
          }
          previousTimestamp = new Date(response[i].servertime);
        }
       
       
      
      //console.log(LEV1_1,"line number 81")
  }
  if(response[i].chargpointname==="LEV4_1"){
      LEV4_1.LEV4_1Energy+=parseFloat(response[i].energyconsumption)
      LEV4_1.LEV4_1TotalSession=(response[i].totalsessions)
      if(parseFloat(response[i].energyconsumption)>0){
          LEV4_1.LEV4_NoOf_chargers="Active"
          // ActiveChargingpoint=(response[i].chargpointname)
          LEV4_1Status=("active")
          NoOfChargers+=1
      }
       if (response[i].totalsessions === 1) {
          if (previousTimestamp) {
            const currentTimestamp = new Date(response[i].servertime);
            const timeDifference = currentTimestamp - previousTimestamp;
            console.log(timeDifference)
            totalUsageTime += timeDifference;
          }
          previousTimestamp = new Date(response[i].servertime);
        }
      
      //console.log(LEV4_1,"line number 85")
  }
  
  if(response[i].chargpointname==="CP11_1"){
      CP11_1.CP11_1Energy+=parseFloat(response[i].energyconsumption)
      CP11_1.CP11_1TotalSession=(response[i].totalsessions)
      if(parseFloat(response[i].energyconsumption)>0){
          CP11_1.CP11_1NoOf_chargers="Active"
         // ActiveChargingpoint=(response[i].chargpointname)
         CP11_1Status=("active")
          NoOfChargers+=1
       }
       if (response[i].totalsessions === 1) {
          if (previousTimestamp) {
            const currentTimestamp = new Date(response[i].servertime);
            const timeDifference = currentTimestamp - previousTimestamp;
            console.log(timeDifference)
            console.log(response[i].chargpointname)
            totalUsageTime += timeDifference;
          }
          previousTimestamp = new Date(response[i].servertime);
        }
      //console.log(LEV4_1,"line number 90")
  }
  if(response[i].chargpointname==="CP12_1"){
      CP12_1.CP12_1Energy+=parseFloat(response[i].energyconsumption)
      CP12_1.CP12_1TotalSession=(response[i].totalsessions)
      //console.log(LEV4_1,"line number 94")
      if(parseFloat(response[i].energyconsumption)>0){
          CP12_1.CP12_1NoOf_chargers="Active"
          //ActiveChargingpoint=(response[i].chargpointname)
          CP12_1Status=("active")
          NoOfChargers+=1
       }
       if (response[i].totalsessions === 1) {
          if (previousTimestamp) {
            const currentTimestamp = new Date(response[i].servertime);
            const timeDifference = currentTimestamp - previousTimestamp;
            console.log(timeDifference)
            console.log(response[i].chargpointname)
            totalUsageTime += timeDifference;
          }
          previousTimestamp = new Date(response[i].servertime);
        }
  }
  if(response[i].chargpointname==="CP13_1"){
      CP13_1.CP13_11Energy+=parseFloat(response[i].energyconsumption)
      CP13_1.CP13_1TotalSession=(response[i].totalsessions)
      if(parseFloat(response[i].energyconsumption)>0){
          CP13_1.CP13_1NoOf_chargers="Active"
          //ActiveChargingpoint=(`${response[i].chargpointname}`)
          CP13_1Status=("active")
          NoOfChargers+=1
       }
       if (response[i].totalsessions === 1) {
          if (previousTimestamp) {
            const currentTimestamp = new Date(response[i].servertime);
            const timeDifference = currentTimestamp - previousTimestamp;
            console.log(timeDifference)
            console.log(response[i].chargpointname)
            totalUsageTime += timeDifference;
          }
          previousTimestamp = new Date(response[i].servertime);
        }
      
     // console.log(LEV4_1,"line number 98")
  }
  if(response[i].chargpointname==="CP14_1"){
      CP14_1.CP14_1Energy+=parseFloat(response[i].energyconsumption)
      CP14_1.CP14_1TotalSession=(response[i].totalsessions)
      if(parseFloat(response[i].energyconsumption)>0){
          CP14_1.CP14_1NoOf_chargers="Active"
          //ActiveChargingpoint=(response[i].chargpointname)
          CP14_1Status=("active")
          NoOfChargers+=1
       }
       if (response[i].totalsessions === 1) {
          if (previousTimestamp) {
            const currentTimestamp = new Date(response[i].servertime);
            const timeDifference = currentTimestamp - previousTimestamp;
            console.log(timeDifference)
            console.log(response[i].chargpointname)
            totalUsageTime += timeDifference;
          }
          previousTimestamp = new Date(response[i].servertime);
        }
      //console.log(LEV4_1,"line number 102")
  }
  
}

// let LEV1_1= {'LEV1_1Energy':0,'LEV1_1TotalSession':0,'LEV1_1NoOf_chargers':0} 
// let LEV4_1= {'LEV4_1Energy':0,'LEV4_1TotalSession':0,'LEV4_NoOf_chargers':0}
// let CP11_1= {'CP11_1Energy':0,'CP11_1TotalSession':0,'CP11_1NoOf_chargers':0}
// let CP12_1= {'CP12_1Energy':0,'CP12_1TotalSession':0,'CP12_1NoOf_chargers':0}
// let CP13_1= {'CP13_11Energy':0,'CP13_1TotalSession':0,'CP13_1NoOf_chargers':0}
// let CP14_1= {'CP14_1Energy':0,'CP14_1TotalSession':0,'CP14_1NoOf_chargers':0}
const finalresult=[]
const totalEnergy=(LEV1_1.LEV1_1Energy+LEV4_1.LEV4_1Energy+CP11_1.CP11_1Energy+CP12_1.CP12_1Energy+CP13_1.CP13_11Energy+CP14_1.CP14_1Energy)
const TotalSessions=(LEV1_1.LEV1_1TotalSession+LEV4_1.LEV4_1TotalSession+CP11_1.CP11_1TotalSession+CP12_1.CP12_1TotalSession+CP13_1.CP13_1TotalSession+CP14_1.CP14_1TotalSession)
//   let LEV1_1=0
//     let LEV4_1=0
//     let CP11_1=0
//     let CP12_1=0
//     let CP13_1=0
//     let CP14_1=0

//console.log(LEV1_1+LEV4_1+CP11_1+CP12_1+CP13_1+CP14_1)
const totalUsageTimeHours =(totalUsageTime / 3600000);

                               
finalresult.push({"totalEnergy":totalEnergy.toFixed(1),"totalSessions":TotalSessions,"NoOfChargersUsed":NoOfChargers,"totalTimeusage":totalUsageTimeHours,"LEV1_1Status":LEV1_1Status,"LEV4_1Status":LEV4_1Status,"CP11_1Status":CP11_1Status,"CP12_1Status":CP12_1Status,"CP13_1Status":CP13_1Status,"CP14_1Status":CP14_1Status,"CP12_1Location":" pond area","CP13_1Location":"pond area","CP14_1Location":"pond area","CP11_1Location":"mlcp 3 Rd floor","LEV1_1Location":"mlcp 4 th floor","LEV4_1Location":"mlcp 4 th floor"})
//console.log(LEV1_1.LEV1_1Energy+LEV4_1.LEV4_1Energy+CP12_1.CP12_1Energy+CP13_1.CP13_11Energy+ CP13_1.CP13_11Energy+CP13_1.CP14_1Energy)
          //res.status(200).send( result );
          res.status(200).send( finalresult );
          console.log(finalresult)
          console.log('Total Usage Time (hours):', totalUsageTimeHours);
          //console.log(totalEnergy)

      }

  })
})
//--------------------------END OF API-------------------------//

//-------------------------------------evcharger api filtered api----------------------------------------//
app.post("/dashboard/EvCharger/Filtered",async(req,res)=>{
  const {date}=req.body
  con.query(`select * from evcharger where date(servertime)= '${date}'`,function(error,result){

      let resultval=0
      if(error){
          console.log(error)
      }
      else{
          const response=(JSON.parse(JSON.stringify(result)))
let CP1_1= {'CP1_1Energy':0,'CP1_1TotalSession':0,'CP1_1NoOf_chargers':0} 
let LEV4_1= {'LEV4_1Energy':0,'LEV4_1TotalSession':0,'LEV4_NoOf_chargers':0}
let CP11_1= {'CP11_1Energy':0,'CP11_1TotalSession':0,'CP11_1NoOf_chargers':0}
let CP12_1= {'CP12_1Energy':0,'CP12_1TotalSession':0,'CP12_1NoOf_chargers':0}
let CP13_1= {'CP13_11Energy':0,'CP13_1TotalSession':0,'CP13_1NoOf_chargers':0}
let CP14_1= {'CP14_1Energy':0,'CP14_1TotalSession':0,'CP14_1NoOf_chargers':0}

let NoOfChargers=0
let LEV1_1Status=""
let LEV4_1Status=""
let CP11_1Status=""
let CP12_1Status=""
let CP13_1Status=""
let CP14_1Status=""



for(let i=0;i<response.length;i++){
  
  if(response[i].chargpointname==="'CP1_1'"){
       CP1_1.CP1_1Energy+=parseFloat(response[i].energyconsumption)
       CP1_1.CP1_1TotalSession=(response[i].totalsessions)
       if(parseFloat(response[i].energyconsumption)>0){
        CP1_1.CP1_1NoOf_chargers="Active"
        CP1_1Status=("active")
          NoOfChargers+=1
       }
   
       
       
      
      //console.log(LEV1_1,"line number 81")
  }
  if(response[i].chargpointname==="LEV4_1"){
      LEV4_1.LEV4_1Energy+=parseFloat(response[i].energyconsumption)
      LEV4_1.LEV4_1TotalSession=(response[i].totalsessions)
      if(parseFloat(response[i].energyconsumption)>0){
          LEV4_1.LEV4_NoOf_chargers="Active"
          // ActiveChargingpoint=(response[i].chargpointname)
          LEV4_1Status=("active")
          NoOfChargers+=1
      }
      
      
      //console.log(LEV4_1,"line number 85")
  }
  
  if(response[i].chargpointname==="CP11_1"){
      CP11_1.CP11_1Energy+=parseFloat(response[i].energyconsumption)
      CP11_1.CP11_1TotalSession=(response[i].totalsessions)
      if(parseFloat(response[i].energyconsumption)>0){
          CP11_1.CP11_1NoOf_chargers="Active"
         // ActiveChargingpoint=(response[i].chargpointname)
         CP11_1Status=("active")
          NoOfChargers+=1
       }
     
      //console.log(LEV4_1,"line number 90")
  }
  if(response[i].chargpointname==="CP12_1"){
      CP12_1.CP12_1Energy+=parseFloat(response[i].energyconsumption)
      CP12_1.CP12_1TotalSession=(response[i].totalsessions)
      //console.log(LEV4_1,"line number 94")
      if(parseFloat(response[i].energyconsumption)>0){
          CP12_1.CP12_1NoOf_chargers="Active"
          //ActiveChargingpoint=(response[i].chargpointname)
          CP12_1Status=("active")
          NoOfChargers+=1
       }
       
  }
  if(response[i].chargpointname==="CP13_1"){
      CP13_1.CP13_11Energy+=parseFloat(response[i].energyconsumption)
      CP13_1.CP13_1TotalSession=(response[i].totalsessions)
      if(parseFloat(response[i].energyconsumption)>0){
          CP13_1.CP13_1NoOf_chargers="Active"
          //ActiveChargingpoint=(`${response[i].chargpointname}`)
          CP13_1Status=("active")
          NoOfChargers+=1
       }
    
      
     // console.log(LEV4_1,"line number 98")
  }
  if(response[i].chargpointname==="CP14_1"){
      CP14_1.CP14_1Energy+=parseFloat(response[i].energyconsumption)
      CP14_1.CP14_1TotalSession=(response[i].totalsessions)
      if(parseFloat(response[i].energyconsumption)>0){
          CP14_1.CP14_1NoOf_chargers="Active"
          //ActiveChargingpoint=(response[i].chargpointname)
          CP14_1Status=("active")
          NoOfChargers+=1
       }
    
  }
  
}


const finalresult=[]
const totalEnergy=(CP1_1.CP1_1Energy+LEV4_1.LEV4_1Energy+CP11_1.CP11_1Energy+CP12_1.CP12_1Energy+CP13_1.CP13_11Energy+CP14_1.CP14_1Energy)
const TotalSessions=(CP1_1.CP1_1TotalSession+LEV4_1.LEV4_1TotalSession+CP11_1.CP11_1TotalSession+CP12_1.CP12_1TotalSession+CP13_1.CP13_1TotalSession+CP14_1.CP14_1TotalSession)


                               
finalresult.push({"totalEnergy":totalEnergy.toFixed(1),
"totalSessions":TotalSessions,
"NoOfChargersUsed":NoOfChargers,
"CP1_1Status":LEV1_1Status,
"LEV4_1Status":LEV4_1Status,
"CP11_1Status":CP11_1Status,
"CP12_1Status":CP12_1Status,
"CP13_1Status":CP13_1Status,
"CP14_1Status":CP14_1Status,
"CP1_1EnergyConsumed":CP1_1.CP1_1Energy,
"LEV4_1EnergyConsumed":LEV4_1.LEV4_1Energy,
"CP11_1EnergyConsumed":CP11_1.CP11_1Energy,
"CP12_1EnergyConsumed":CP12_1.CP12_1Energy,
"CP13_1EnergyConsumed":CP13_1.CP13_11Energy,
"CP14_1EnergyConsumed":CP14_1.CP14_1Energy,
"CP12_1Location":" pond area",
"CP13_1Location":"pond area",
"CP14_1Location":"pond area",
"CP11_1Location":"mlcp 3 Rd floor",
"LEV1_1Location":"mlcp 4 th floor",
"LEV4_1Location":"mlcp 4 th floor"
})

          res.status(200).send( finalresult );
          console.log(finalresult)
          //console.log(totalEnergy)

      }

  })
})

//----------------------------------------------------end of  api --------------------------------------//


//------------------------------battery 5min analystics  ------------------------------//
app.get("/analytics/battery", async (req, res) => {
    meterDb.query("select * from meterdata.batteryfiveminute where date(received_time)=curdate() order by received_time asc", function (error, result) {
      const batteryData = [];
      const energy = [];
      const packsoc = [];
      const timestamp = [];
      const resultData=[]
  
      if (error) {
        console.log(error);
      } else {
        const response = JSON.parse(JSON.stringify(result));
        for (let i = 0; i < response.length; i++) {
          if (response[i].max_pacsoc) {
            if (response[i].upsbatterystatus==="IDLE") {
              energy.push(response[i].idle_energystatues);
              packsoc.push(response[i].max_pacsoc);
              let date = new Date(response[i].received_time);
              const hours = date.getHours().toString().padStart(2, '0');
              const minutes = date.getMinutes().toString().padStart(2, '0');
              // const seconds = date.getSeconds().toString().padStart(2, '0');
              const timestamp = `${hours}:${minutes}`;
              //timestamp.push(date);
              resultData.push({"packsoc":parseInt(response[i].max_pacsoc),"batteryEnergy":0.01,"timestamp":timestamp,"batteryStatus":response[i].upsbatterystatus})

            }
            if (response[i].upsbatterystatus==="DCHG") {
              energy.push((response[i].total_upsdidchargingenergy_diff)*-1);
              packsoc.push(response[i].max_pacsoc);
              let date = new Date(response[i].received_time);
              const hours = date.getHours().toString().padStart(2, '0');
              const minutes = date.getMinutes().toString().padStart(2, '0');
              // const seconds = date.getSeconds().toString().padStart(2, '0');
              const timestamp = `${hours}:${minutes}`;
              //timestamp.push(date);
              resultData.push({"packsoc":parseInt(response[i].max_pacsoc),"batteryEnergy":parseFloat((response[i].total_upsdidchargingenergy_diff)*-1),"timestamp":timestamp,"batteryStatus":response[i].upsbatterystatus})
            }
            if (response[i].upsbatterystatus==="CHG") {
              energy.push(response[i].total_upschargingenergy_diff);
              packsoc.push(response[i].max_pacsoc);
              let date = new Date(response[i].received_time);
              const hours = date.getHours().toString().padStart(2, '0');
              const minutes = date.getMinutes().toString().padStart(2, '0');
              // const seconds = date.getSeconds().toString().padStart(2, '0');
              const timestamp = `${hours}:${minutes}`;
              //timestamp.push(date);

              resultData.push({"packsoc":parseInt(response[i].max_pacsoc),"batteryEnergy":parseFloat(response[i].total_upschargingenergy_diff),"timestamp":timestamp,"batteryStatus":response[i].upsbatterystatus})
            }
          }
        }
  
  
        res.send(resultData);
        console.log(result.length)
      }
    });
  });

//----------------------------------------------------------------------//

//--------------------------------battery voltage vs current graph-------------------------------//
app.get("/analytics/battery/voltage&current", async (req, res) => {
  EMSDB.query("SELECT * FROM EMS.EMSUPSbattery where date(received_time)=curdate() GROUP BY DATE_FORMAT(received_time, '%Y-%m-%d %H:%i');", function (error, result) {
    const resultData=[]

    if (error) {
      console.log(error);
    } else {
      const response = JSON.parse(JSON.stringify(result));

       for (let i = 0; i < response.length; i++) {
        if(response[i].batteryVoltage){}
        let date = new Date(response[i].received_time);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        // const seconds = date.getSeconds().toString().padStart(2, '0');
        const timestamp = `${hours}:${minutes}`;
        
        resultData.push({"timestamp":timestamp,"batteryVoltage":parseInt(response[i].batteryvoltage),"batteryCurrent":parseFloat(response[i].batterycurrent)})
      }


      res.send(resultData);
      console.log(response.length)
    }
  });
});


//-------------------------------------end of api------------------------------------------//
//-------------------------filtering the battery --------------------------//
//-----------------------filter api for energy vs packsoc-------------------//
app.post("/analytics/fivemingraphs", (req, res) => {
  const { date} = req.body;
  const endResult=[]
  const batteryData = [];
   const energy = [];
   const packsoc = [];
   const timestamp = [];
  const resultData=[]
  const query = `select * from meterdata.batteryfiveminute where date(received_time)='${date}' order by received_time asc`;
  meterDb.query(query, (error, response) => {
    if (error) {
      console.error(error);
      return res.status(500).json({ message: 'An error occurred' });
    }
    for (let i = 0; i < response.length; i++) {
      if (response[i].max_pacsoc) {
        if (response[i].upsbatterystatus==="IDLE") {
          energy.push(response[i].idle_energystatues);
          packsoc.push(response[i].max_pacsoc);
          let date = new Date(response[i].received_time);
          const hours = date.getHours().toString().padStart(2, '0');
          const minutes = date.getMinutes().toString().padStart(2, '0');
          // const seconds = date.getSeconds().toString().padStart(2, '0');
          const timestamp = `${hours}:${minutes}`;
          //timestamp.push(date);
          endResult.push({"packsoc":parseInt(response[i].max_pacsoc),"batteryEnergy":0.01,"timestamp":timestamp,"batteryStatus":response[i].upsbatterystatus})

        }
        if (response[i].upsbatterystatus==="DCHG") {
          energy.push((response[i].total_upsdidchargingenergy_diff)*-1);
          packsoc.push(response[i].max_pacsoc);
          let date = new Date(response[i].received_time);
          const hours = date.getHours().toString().padStart(2, '0');
          const minutes = date.getMinutes().toString().padStart(2, '0');
          // const seconds = date.getSeconds().toString().padStart(2, '0');
          const timestamp = `${hours}:${minutes}`;
          //timestamp.push(date);
          endResult.push({"packsoc":parseInt(response[i].max_pacsoc),"batteryEnergy":parseFloat((response[i].total_upsdidchargingenergy_diff)*-1),"timestamp":timestamp,"batteryStatus":response[i].upsbatterystatus})
        }
        if (response[i].upsbatterystatus==="CHG") {
          energy.push(response[i].total_upschargingenergy_diff);
          packsoc.push(response[i].max_pacsoc);
          let date = new Date(response[i].received_time);
          const hours = date.getHours().toString().padStart(2, '0');
          const minutes = date.getMinutes().toString().padStart(2, '0');
          // const seconds = date.getSeconds().toString().padStart(2, '0');
          const timestamp = `${hours}:${minutes}`;
          //timestamp.push(date);

          endResult.push({"packsoc":parseInt(response[i].max_pacsoc),"batteryEnergy":parseFloat(response[i].total_upschargingenergy_diff),"timestamp":timestamp,"batteryStatus":response[i].upsbatterystatus})
        }
      }
    }
      console.log(endResult.length)
    return res.json(endResult);
  });
});
//-----------------------end of filter----------------//

//------------------------filter api for voltage vs current for 1min table---------------//
app.post("/analytics/onemingraph", (req, res) => {
  const { date} = req.body;
  const currentvolt=[]
  
  const query = `select * from batteryoneminute where date(received_time)= '${date}'order by received_time asc`;
  meterDb.query(query, (error, response) => {
    if (error) {
      console.error(error);
      return res.status(500).json({ message: 'An error occurred' });
    }
    for (let i = 0; i < response.length; i++) {
      if(response[i].batteryVoltage){}
      let date = new Date(response[i].received_time);
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      // const seconds = date.getSeconds().toString().padStart(2, '0');
      const timestamp = `${hours}:${minutes}`;
      
      currentvolt.push({"timestamp":timestamp,"batteryVoltage":parseInt(response[i].batteryvoltage),"batteryCurrent":parseFloat(response[i].batterycurrent)})
    }
    console.log(currentvolt)
    return res.json(currentvolt);
  });
});
//-------------------------end of api-------------------------//


//-----------------------------end of api-------------------------------//




            //ALERTS Logs
//

app.get("/Alert/Logs",async(req,res)=>{
    con.query("select * from alertLogs order by alerttime desc ",function(err,result,feilds){
        const logVavlues=[]
        if(err){
            console.log(err)
        }
        else{
            const response=(JSON.parse(JSON.stringify(result)))
            console.log(response.length,"alert logs  executed");

            for(let i=0;i<response.length;i++){
            const date = new Date(response[i].alerttime);
            const alertTime = date.toLocaleString();
            const alertTimestamp=alertTime.split(',')
            logVavlues.push({"id":response[i].recordId,"alerttimereceived":alertTimestamp,"alert":response[i].alert,"limitvalue":response[i].limitvalue,"systemName":response[i].systemName,"severity":response[i].severity,"action":response[i].action})
            }
            res.send(logVavlues)
            console.log(logVavlues)
        }
    })
   
}) 

// alerts filtering data api

app.post("/Alerts/filter", async (req, res) => {
    const { systemName } = req.body;
    const AlertFilter = [];
    if(systemName==="Alert Logs"){
      let query="select * from alertLogs order by alerttime desc"
      con.query(query, (error, results) => {
        if (error) {
          console.error(error);
          return res.status(500).json({ message: 'An error occurred' });
        }
        console.log(results.length,`filter for ${systemName}  alert executed`);
        for (let i = 0; i < results.length; i++) {
          const date = new Date(results[i].alerttime);
          const hours = date.getHours().toString().padStart(2, '0');
          const minutes = date.getMinutes().toString().padStart(2, '0');
          const timestamp = `${hours}:${minutes}`;
          const year = date.getFullYear().toString();
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          const day = date.getDate().toString().padStart(2, '0');
          const formattedDate = `${day}/${month}/${year}`;
          const timeview = [formattedDate, timestamp];
    
          AlertFilter.push({"id":results[i].recordId,"alerttimereceived":timeview,"alert":results[i].alert,"limitvalue":results[i].limitvalue,"systemName":results[i].systemName,"severity":results[i].severity,"action":results[i].action});
        }
        //console.log(AlertFilter);
        return res.json(AlertFilter);
      });
    }
    else{
      let query=`select * from alertLogs where systemName ='${systemName}' order by alerttime desc `
      con.query(query, (error, results) => {
        if (error) {
          console.error(error);
          return res.status(500).json({ message: 'An error occurred' });
        }
        console.log(results.length,`filter for ${systemName}  alert executed`);
        for (let i = 0; i < results.length; i++) {
          const date = new Date(results[i].alerttime);
          const hours = date.getHours().toString().padStart(2, '0');
          const minutes = date.getMinutes().toString().padStart(2, '0');
          const timestamp = `${hours}:${minutes}`;
          const year = date.getFullYear().toString();
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          const day = date.getDate().toString().padStart(2, '0');
          const formattedDate = `${day}/${month}/${year}`;
          const timeview = [formattedDate, timestamp];
    
          AlertFilter.push({"id":results[i].recordId,"alerttimereceived":timeview,"alert":results[i].alert,"limitvalue":results[i].limitvalue,"systemName":results[i].systemName,"severity":results[i].severity,"action":results[i].action});
        }
        //console.log(AlertFilter);
        return res.json(AlertFilter);
      });
    }
   
      // con.query(query, (error, results) => {
      //   if (error) {
      //     console.error(error);
      //     return res.status(500).json({ message: 'An error occurred' });
      //   }
      //   console.log(results.length,`filter for ${systemName}  alert executed`);
      //   for (let i = 0; i < results.length; i++) {
      //     const date = new Date(results[i].alerttime);
      //     const hours = date.getHours().toString().padStart(2, '0');
      //     const minutes = date.getMinutes().toString().padStart(2, '0');
      //     const timestamp = `${hours}:${minutes}`;
      //     const year = date.getFullYear().toString();
      //     const month = (date.getMonth() + 1).toString().padStart(2, '0');
      //     const day = date.getDate().toString().padStart(2, '0');
      //     const formattedDate = `${day}/${month}/${year}`;
      //     const timeview = [formattedDate, timestamp];
    
      //     AlertFilter.push({"id":results[i].recordId,"alerttimereceived":timeview,"alert":results[i].alert,"limitvalue":results[i].limitvalue,"systemName":results[i].systemName,"severity":results[i].severity,"action":results[i].action});
      //   }
      //   //console.log(AlertFilter);
      //   return res.json(AlertFilter);
      // });
  });
//--------------------------------------------------------------------------------------------------------------------------------------

//Thermal alert api



// --------------------------------------------------------------------------------------------------------------------------------------

 //controlls post request
 app.post('/controlls', function (req, res) {
    const now = new Date();
const formattedDate = now.toLocaleString('en-US', { 
  year: 'numeric', 
  month: '2-digit', 
  day: '2-digit', 
  hour: '2-digit', 
  minute: '2-digit', 
  second: '2-digit', 
  hour12: false
}).replace(',', '');
console.log(formattedDate);

    const { functioncode, starttime,endtime,capacity } = req.body;
    console.log(req.body.functioncode)
    const sql = 'INSERT INTO EMSUPSshedulebatterycontrol (functioncode, starttime,endtime) VALUES (?, ?, ?)';
    con.query(sql, [functioncode, starttime,endtime], function (error, results, fields) {
        if (error) {
            return res.status(500).send(error);
        }
        else{
            console.log(results)
            res.status(200).send('parameter  added successfully!');
        }
        //return 
    });
});



app.post('/instantaneous', function (req, res) {



    const { functioncode,batterystatus} = req.body;
    console.log(req.body.functioncode)
    const sql = 'INSERT INTO instantaneous_ups (functioncode,batterystatus) VALUES (?,?)';
    con.query(sql, [functioncode,batterystatus], function (error, results, fields) {
        if (error) {
            return res.status(500).send(error);
        }
        else{
            console.log(results)
            res.status(200).send('parameter  added successfully!');
        }
        //return 
    });
});



app.get("/acknowledment",async(req,res)=>{
    con.query("select * from acknowlegment order by id desc ",function(err,result,feilds){
        if(err){
            console.log(err)
        }
        else{
            const response=(JSON.parse(JSON.stringify(result)))
            res.send(response)
            console.log(response.length)
        }
    })
    
})



  
  
  // data filtering for single days data
  app.get("/singleday/hvacSchneider7230Polling", (req, res) => {
      const { date} = req.body;
      const filterData = [];
     
      const query = `SELECT * FROM peakdemanddaily WHERE DATE(polledTime) ="2023-08-31"`;
      meterDb.query(query, (error, results) => {
        if (error) {
          console.error(error);
          return res.status(500).json({ message: 'An error occurred' });
        }
        console.log(results.length);
    for (let i = 0; i < results.length; i++) {
      const date = new Date(results[i].polledTime);
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const timestamp = `${hours}:${minutes}`;
      const year = date.getFullYear().toString();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const formattedDate = `${day}/${month}/${year}`;
      const timeview = [formattedDate, timestamp];

      filterData.push({ "timestamp": timeview, "peakdemand": Math.trunc(results[i].peakdemand),"limitLine":parseInt(4000) });
    }
    console.log(filterData);
    return res.json(filterData);
      });
    });

    //---------------------------//
    
    
    //-----------------Daily peakDemand filtered api------------------//
    app.post("/filter/hvacSchneider7230Polling", (req, res) => {
  const { date, endDate,month } = req.body;
  const filterData = [];
  console.log(date, endDate);

  let query;
  if (endDate) {
    query = `SELECT * FROM peakdemanddaily WHERE DATE(polledTime) BETWEEN '${date}' AND '${endDate}'`;
    console.log('bar graph executed');
  }
//  else{
//     query = `SELECT * FROM peakdemandquarter WHERE DATE(polledTime) = '${date}'`;
//     console.log('single day filter executed')

//   }

  meterDb.query(query, (error, results) => {
    if (error) {
      console.error(error);
      return res.status(500).json({ message: 'An error occurred' });
    }
    console.log(results.length);
    for (let i = 0; i < results.length; i++) {
      const date = new Date(results[i].polledTime);
      let value=date.toLocaleString()
      const dateValue=value.split(",")
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const timestamp = `${hours}:${minutes}`;
      const year = date.getFullYear().toString();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const formattedDate = `${day}/${month}/${year}`;
      const timeview = [formattedDate, timestamp];

      filterData.push({ "timestamp": dateValue[0], "peakdemand": Math.trunc(results[i].peakdemand),"limitLine":parseInt(4000) });
    }
    console.log(filterData);
    return res.json(filterData);
  });
});




app.get("/peak/initialgraph",async(req,res)=>{
  meterDb.query("SELECT * FROM peakdemanddaily WHERE DATE(polledTime) BETWEEN DATE(CURDATE() - INTERVAL 7 DAY) AND DATE(CURDATE() - INTERVAL 1 DAY);",function(err,result,feilds){
      const viewData=[]
      if(err){
          console.log(err)
      }
      else{
          const response=(JSON.parse(JSON.stringify(result)))
          for(let i=0;i<response.length;i++){
              let date=new Date(response[i].polledTime)
              let value=date.toLocaleString()
              const dateValue=value.split(",")
              console.log(value)
              const hours = date.getHours().toString().padStart(2, '0');
         const minutes = date.getMinutes().toString().padStart(2, '0');
         // const seconds = date.getSeconds().toString().padStart(2, '0');
         const timestamp = `${hours}:${minutes}`;
              viewData.push({"polledTime":dateValue[0],"peakdemand":Math.trunc(response[i].peakdemand)})


          }
          res.send(viewData)
          console.log(viewData)
      }
  })
  
})
//-------------------------------end of api-------------------------------------//
      
  

//--------------------current day PeakDemand api ----------------------------------//      
       app.get("/peak/hvacSchneider7230Polling",async(req,res)=>{
        chakradb.query("SELECT max(totalApparentPower2) as totalApparentPower2 ,polledTime FROM hvacSchneider7230Polling where date(polledTime)=curdate() GROUP BY DATE_FORMAT(polledTime, '%Y-%m-%d %H:%i');",function(err,result,feilds){
            const viewData=[]
            if(err){
                console.log(err)
            }
            else{
                const response=(JSON.parse(JSON.stringify(result)))
                for(let i=0;i<response.length;i++){
                    let date=new Date(response[i].polledTime)
                    const hours = date.getHours().toString().padStart(2, '0');
               const minutes = date.getMinutes().toString().padStart(2, '0');
               // const seconds = date.getSeconds().toString().padStart(2, '0');
               const timestamp = `${hours}:${minutes}`;
                viewData.push({"polledTime":timestamp,"peakdemand":Math.trunc(response[i].totalApparentPower2),"limitLine":parseInt(4000)})


                }
                res.send(viewData)
                console.log(viewData)
            }
        })
        
    })

  //---------------------------------END of api---------------------------------------//

  //-----------------single day filter PeakDemand api--------------------//

  app.post("/singleDayFilter/hvacSchneider7230Polling", (req, res) => {
    const { date} = req.body;
    const viewData=[]
   
    const query = `SELECT max(totalApparentPower2) as totalApparentPower2 ,polledTime FROM hvacSchneider7230Polling where date(polledTime)='${date}' GROUP BY DATE_FORMAT(polledTime, '%Y-%m-%d %H:%i') `;
    chakradb.query(query, (error, results) => {
      if (error) {
        console.error(error);
        return res.status(500).json({ message: 'An error occurred' });
      }
      const response=(JSON.parse(JSON.stringify(results)))
      for(let i=0;i<response.length;i++){
        let date=new Date(response[i].polledTime)
        const hours = date.getHours().toString().padStart(2, '0');
   const minutes = date.getMinutes().toString().padStart(2, '0');
   // const seconds = date.getSeconds().toString().padStart(2, '0');
   const timestamp = `${hours}:${minutes}`;
    viewData.push({"polledTime":timestamp,"peakdemand":Math.trunc(response[i].totalApparentPower2),"limitLine":parseInt(4000)})


    }
      console.log(viewData)
      return res.json(viewData);
    });
  });

  //----------------------------END of api
    
     // wheeled in solar data filter according to datewise



//---------initial graph--------------//
app.get("/initial/wheeledinsolr", (req, res) => {
  const { date} = req.body;
  const inverters=[]
  const INV1=[]
  const INV2=[]
  const INV3=[]
  const INV4=[]
  const INV5=[]
  const INV6=[]
  const INV7=[]
  const INV8=[]
 
  const query = 'SELECT * FROM inverterprocessinghourly WHERE DATE(invertertimestamp) = curdate() order by invertertimestamp asc;'
  meterDb.query(query, (error, results) => {
    if (error) {
      console.error(error);
      return res.status(500).json({ message: 'An error occurred' });
    }
   
    for(let i=0;i<results.length;i++){
      if(results[i].inverterrecordid===1){
          INV1.push(results[i])
      }
      else if(results[i].inverterrecordid===2){
          INV2.push(results[i])

      }
      else if(results[i].inverterrecordid===3){
          INV3.push(results[i])

      }
      else if(results[i].inverterrecordid===4){
          INV4.push(results[i])

      }
      else if(results[i].inverterrecordid===5){
          INV5.push(results[i])

      }
      else if(results[i].inverterrecordid===6){
          INV6.push(results[i])

      }
      else if(results[i].inverterrecordid===7){
          INV7.push(results[i])

      }
      else if(results[i].inverterrecordid===8){
          INV8.push(results[i])

      }
    }
  inverters.push({"INV1":INV1,"INV2":INV2,"INV3":INV3,"INV4":INV4,"INV5":INV5,"INV6":INV6,"INV7":INV7,"INV8":INV8})
  console.log(inverters[0].INV1.length)
    return res.json(inverters);
  });
});
//-------------end api-------------//


// ----------------data filtering for single days data-------------------------//
app.post("/singleday/wheeledinsolr", (req, res) => {
    const { date} = req.body;
    const inverters=[]
    const INV1=[]
    const INV2=[]
    const INV3=[]
    const INV4=[]
    const INV5=[]
    const INV6=[]
    const INV7=[]
    const INV8=[]
   
    const query = `SELECT * FROM meterdata.inverterprocessinghourly WHERE DATE(invertertimestamp) = '${date}' `;
    meterDb.query(query, (error, results) => {
      if (error) {
        console.error(error);
        return res.status(500).json({ message: 'An error occurred' });
      }
     
      for(let i=0;i<results.length;i++){
        if(results[i].inverterrecordid===1){
            INV1.push(results[i])
        }
        else if(results[i].inverterrecordid===2){
            INV2.push(results[i])

        }
        else if(results[i].inverterrecordid===3){
            INV3.push(results[i])

        }
        else if(results[i].inverterrecordid===4){
            INV4.push(results[i])

        }
        else if(results[i].inverterrecordid===5){
            INV5.push(results[i])

        }
        else if(results[i].inverterrecordid===6){
            INV6.push(results[i])

        }
        else if(results[i].inverterrecordid===7){
            INV7.push(results[i])

        }
        else if(results[i].inverterrecordid===8){
            INV8.push(results[i])

        }
      }
    inverters.push({"INV1":INV1,"INV2":INV2,"INV3":INV3,"INV4":INV4,"INV5":INV5,"INV6":INV6,"INV7":INV7,"INV8":INV8})
    console.log(inverters[0].INV2.length)
      return res.json(inverters);
    });
  });
  //------------------------end of api------------------------------//


 //------------------roofTop hourly data post request-------------------//
 app.post("/roofTopHourly", async (req, res) => {
    const { date } = req.body;
    meterDb.query(`SELECT * FROM rooftophourly WHERE DATE(timestamp) = '${date}'`, function(err, qrres) {
      if (err) {
        console.log(err);
      } else {
        const response = JSON.parse(JSON.stringify(qrres));
        const data = response.map(entry => {
          const decimalval = Math.trunc(entry.total_cumulative_energy);
          const radiation=entry.sensor_solar_radiation
          const date = new Date(entry.timestamp);
          const hours = date.getHours().toString().padStart(2, '0');
          const minutes = date.getMinutes().toString().padStart(2, '0');
          // const seconds = date.getSeconds().toString().padevchargerStart(2, '0');
          const timestamp = `${hours}:${minutes}`;
          //const timestamp = `${hours}`;
          return { timestamp, energy: decimalval,solarRadiation:radiation};
        });
        console.log(data);
        res.send(data);
      }
    });
  });
  //------------------------end of api--------------------------------//
  app.get("/current/roofTopHourlygraph", async (req, res) => {
    const { date } = req.body;
    meterDb.query(`SELECT * FROM rooftophourly WHERE DATE(timestamp) = curdate()`, function(err, qrres) {
      if (err) {
        console.log(err);
      } else {
        const response = JSON.parse(JSON.stringify(qrres));
        const data = response.map(entry => {
          const decimalval = Math.trunc(entry.total_cumulative_energy);
          const radiation=entry.sensor_solar_radiation
          const date = new Date(entry.timestamp);
          const hours = date.getHours().toString().padStart(2, '0');
          const minutes = date.getMinutes().toString().padStart(2, '0');
          // const seconds = date.getSeconds().toString().padevchargerStart(2, '0');
          const timestamp = `${hours}:${minutes}`;
          //const timestamp = `${hours}`;
          return { timestamp, energy: decimalval,solarRadiation:radiation};
        });
        console.log(data);
        res.send(data);
      }
    });
  });


  //-----------------------------------------------------------------//



  //-------------analytics page of wmsMeter graph(post request according to date)------------//
  app.post("/wmsMeter/graphs", (req, res) => {
    const { date} = req.body;
   
    const query = `SELECT * FROM HourlyMeterData WHERE DATE(timestamp) = '${date}'`;
    meterDb.query(query, (error, results) => {
        const wmsMeterdata=[]
      if (error) {
        console.error(error);
        return res.status(500).json({ message: 'An error occurred' });
      }
      else{
        const response = JSON.parse(JSON.stringify(results));
        for(let i=0;i<response.length;i++){
            const date = new Date(response[i].timestamp);
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            // const seconds = date.getSeconds().toString().padStart(2, '0');
            const timestamp = `${hours}:${minutes}`;
           
            wmsMeterdata.push({"cumulativepower":Math.trunc(response[i].cummulativemeterpower),"wmsirradiation":(Number(response[i].wmsirradiation)).toFixed(1),"instantaniousEnergy":Math.trunc(response[i].instantaneousenergy),"timestamp":timestamp,"expectedEnergy":Math.trunc(response[i].expectedwms)})

        }
        console.log(wmsMeterdata)
        res.send(wmsMeterdata)
      }
   
    });
  })
  //----------------------------------- end of API-------------------------//
  //----------------------get request for wmsMeter data for analytics page graph-----------
  app.get("/initialgraph/wmsMeter", (req, res) => {
    const { date} = req.body;
   
    const query = 'SELECT * FROM HourlyMeterData WHERE DATE(timestamp) = curdate()';
    meterDb.query(query, (error, results) => {
        const wmsMeterdata=[]
      if (error) {
        console.error(error);
        return res.status(500).json({ message: 'An error occurred' });
      }
      else{
        const response = JSON.parse(JSON.stringify(results));
        for(let i=0;i<response.length;i++){
            const date = new Date(response[i].timestamp);
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            // const seconds = date.getSeconds().toString().padStart(2, '0');
            const timestamp = `${hours}:${minutes}`;
            wmsMeterdata.push({"cumulativepower":Math.trunc(response[i].cummulativemeterpower),"wmsirradiation":(Number(response[i].wmsirradiation)).toFixed(1),"instantaniousEnergy":Math.trunc(response[i].instantaneousenergy),"timestamp":timestamp,"expectedEnergy":Math.trunc(response[i].expectedwms)})

        }
        //console.log(wmsMeterdata)
        res.send(wmsMeterdata)
      }
   
    });
  })
    
  //-------------------------end of API---------------------------------//
    

  //--------------------------chillers status api-----------------------//
  app.get("/chillers/status",async(req,res)=>{
    meterDb.query("SELECT * FROM chillarstatus where date(timestamp)=curdate();",function(err,result,feilds){
        const viewData=[]
        if(err){
            console.log(err)
        }
        else{
            const response=(JSON.parse(JSON.stringify(result)))
            for(let i=0;i<response.length;i++){
                let date=new Date(response[i].timestamp)
                const hours = date.getHours().toString().padStart(2, '0');
           const minutes = date.getMinutes().toString().padStart(2, '0');
           // const seconds = date.getSeconds().toString().padStart(2, '0');
           const timestamp = `${hours}:${minutes}`;
            viewData.push({"polledTime":timestamp,"chiller1Status":response[i].chillar1,"chiller2Status":response[i].chillar2,"chiller3Status":response[i].chillar3,"chiller4Status":response[i].chillar4,"chiller5Status":response[i].chillar5,"chiller6Status":response[i].chillar6,"chiller7Status":response[i].chillar7,"chiller8Status":response[i].chillar8})


            }
            res.send(viewData)
            console.log(viewData)
        }
    })
    
})
  //--------------------------end of api-------------------------------//

  //--------------------Chillers Status date filter function ---------------//
  app.post("/Chillers/Datefilter", async (req, res) => {
    const { date } = req.body;
    meterDb.query(`SELECT * FROM chillarstatus WHERE DATE(timestamp) = '${date}'`, function(err, qrres) {
      if (err) {
        console.log(err);
      } else {
        const response = JSON.parse(JSON.stringify(qrres));
        const data = response.map(entry => {
          const date = new Date(entry.timestamp);
          const hours = date.getHours().toString().padStart(2, '0');
          const minutes = date.getMinutes().toString().padStart(2, '0');
          // const seconds = date.getSeconds().toString().padevchargerStart(2, '0');
          const timestamp = `${hours}:${minutes}`;
          //const timestamp = `${hours}`;
          return { timestamp, chillar1:entry.chillar1,chillar2:entry.chillar2,chillar3:entry.chillar3,chillar4:entry.chillar4,chillar5:entry.chillar5,chillar6:entry.chillar6,chillar7:entry.chillar7,chillar8:entry.chillar8};
        });
        console.log(data);
        res.send(data);
      }
    });
  });

  //-------------------------end of api---------------------------------//



  //----------------------- thermal  instantanious control -----------------------//

  app.post('/thermal/controll', function (req, res) {
    var now = new Date();
var formattedDate = now.toLocaleString('en-US', { 
  year: 'numeric', 
  month: '2-digit', 
  day: '2-digit', 
  hour: '2-digit', 
  minute: '2-digit', 
  second: '2-digit', 
  hour12: false
}).replace(',', '');

console.log(formattedDate,"line 1680");

//var polledTimeStamp=formattedDate

    const { controlStatus, polledTime,functioncode} = req.body;
    console.log(req.body)
    const sql = 'INSERT INTO thermalInstantaneous (controlStatus, polledTime,functionCode) VALUES (?, ?, ?)';
      EMSDB.query(sql, [controlStatus, polledTime,functioncode], function (error, results, fields) {
        if (error) {
            return res.status(500).send(error);
        }
        else{
            console.log(results)
            res.status(200).send('parameter  added successfully!');
        }
        //return 
    });
});
  //--------------------end of api----------------------------------//


  //------------------------------thermal status api------------------//
  app.get('/thermal/status',async(req,res)=>{
    con.query("SELECT * FROM thermalStatus where date(polledTime)=curdate();",function(err,result,feilds){
      const theramlDate=[]
      if(err){
          console.log(err)
      }
      else{
          const response=(JSON.parse(JSON.stringify(result)))
          for(let i=0;i<response.length;i++){
              let date=new Date(response[i].polledTime)
              const hours = date.getHours().toString().padStart(2, '0');
         const minutes = date.getMinutes().toString().padStart(2, '0');
         // const seconds = date.getSeconds().toString().padStart(2, '0');
         const timestamp = `${hours}:${minutes}`;
         theramlDate.push({"polledTime":timestamp,"ThermalCHGStatus":parseInt(response[i].chgStatus),"thermalDCHGStatus":parseInt((response[i].dchgStatus)*-1)})


          }
          res.send(theramlDate)
          console.log(theramlDate)
      }
  })


  })
  //-------------------------------end of api---------------------//


  //----------------------------------thermalStatus dateFilter api-----------------//

  app.post("/ThermalStatus/Datefilter", async (req, res) => {
    const { date } = req.body;
    con.query(`SELECT * FROM thermalStatus WHERE DATE(polledTime) = '${date}'`, function(err, qrres) {
      if (err) {
        console.log(err);
      } else {
        const response = JSON.parse(JSON.stringify(qrres));
        const data = response.map(entry => {
          const date = new Date(entry.polledTime);
          const hours = date.getHours().toString().padStart(2, '0');
          const minutes = date.getMinutes().toString().padStart(2, '0');
          // const seconds = date.getSeconds().toString().padevchargerStart(2, '0');
          const timestamp = `${hours}:${minutes}`;
          //const timestamp = `${hours}`;
          return { timestamp,thermalCHGStatus:parseInt(entry.chgStatus),thermalDCHGStatus:parseInt((entry.dchgStatus)*-1)};
        });
        console.log(data);
        res.send(data);
      }
    });
  });



  //--------------------------end of api-----------------------------------//





  //----------------------chiller Dashboard api`s for date filters ----------------------------------------------//
  //-------------------------------thermal stored water temparature api date filter-----------------------//
  app.post("/thermal/storedWaterTemp/dateFiltered",async(req,res)=>{
    const {date}=req.body
    const thermalWaterTemp=[]
    meterDb.query(`SELECT * FROM meterdata.thermalstoredwaterquaterly where date(timecolumn)='${date}'`,function(error,result,feild){
      if(error){
        console.log(error)
      }
      else{
        const response=(JSON.parse(JSON.stringify(result)))
        for(let i=0;i<response.length;i++){
          let date=new Date(response[i].timecolumn)
          const hours = date.getHours().toString().padStart(2, '0');
     const minutes = date.getMinutes().toString().padStart(2, '0');
     // const seconds = date.getSeconds().toString().padStart(2, '0');
     const timestamp = `${hours}:${minutes}`;
     thermalWaterTemp.push({"polledTime":timestamp,"storedwatertemperature":parseFloat(response[i].storedwatertemperature)})


      }
      console.log(thermalWaterTemp)
        res.send(thermalWaterTemp)

        
      }
    })
  })
  //--------------------------------end of api----------------------------//


  //-----------------------------chiller Loading api date Filter-------------------------------//
  app.post("/chillerDashboard/ChillerLoading/dateFiltered",async(req,res)=>{
    const {date}=req.body
    const ChillerLoadingData=[]
    meterDb.query(`SELECT * FROM meterdata.chillarloading where date(lastTimestamp)="${date}"`,function(error,result,feild){
      if(error){
        console.log(error)
      }
      else{
        const response=(JSON.parse(JSON.stringify(result)))
        for(let i=0;i<response.length;i++){
          let date=new Date(response[i].lastTimestamp)
          const hours = date.getHours().toString().padStart(2, '0');
     const minutes = date.getMinutes().toString().padStart(2, '0');
     // const seconds = date.getSeconds().toString().padStart(2, '0');
     const timestamp = `${hours}:${minutes}`;
     ChillerLoadingData.push({"polledTime":timestamp,"c1loading":parseFloat(response[i].c1loading),"c2loading":parseFloat(response[i].c2loading),"c3loading":parseFloat(response[i].c3loading),"c4loading":parseFloat(response[i].c4loading)})


      }
      console.log(ChillerLoadingData.length)
        res.send(ChillerLoadingData)

        
      }
    })
  })


//----------------------------END of chiller Loading api-------------------------------------//






//---------------------------------thermalinletoutlet (condenser and evaporator) date filters-----------------------//

app.post("/chillerDashboard/thermalinletoutlet/condenser/evaporator/dateFiltered",async(req,res)=>{
  const {date}=req.body
  const thermalinletoutletData=[]
  meterDb.query(`SELECT * FROM thermalinletoutlet where date(Timestamp)="${date}"`,function(error,result,feild){
    if(error){
      console.log(error)
    }
    else{
      const response=(JSON.parse(JSON.stringify(result)))
      for(let i=0;i<response.length;i++){
        let date=new Date(response[i].Timestamp)
        const hours = date.getHours().toString().padStart(2, '0');
   const minutes = date.getMinutes().toString().padStart(2, '0');
   // const seconds = date.getSeconds().toString().padStart(2, '0');
   const timestamp = `${hours}:${minutes}`;
   thermalinletoutletData.push({"polledTime":timestamp,"avg_commonHeaderinletTemp":parseFloat(response[i].avg_commonHeaderinletTemp),"avg_commonHeaderoutletTemp":parseFloat(response[i].avg_commonHeaderoutletTemp),"avg_condenserLineInletTemp":parseFloat(response[i].avg_condenserLineInletTemp),"avg_condenserLineOutletTemp":parseFloat(response[i].avg_condenserLineOutletTemp),"avg_commonHeaderFlowrate":parseFloat(response[i].avg_commonHeaderFlowrate),"avg_condenserLineFlowrate":parseFloat(response[i].avg_condenserLineFlowrate)})


    }
    console.log(thermalinletoutletData.length)
      res.send(thermalinletoutletData)

      
    }
  })
})

//-------------------------------END of thermalinletoutlet (condenser and evaporator) api---------------------------------//

//---------------------------------Average of C1 cop to C4 cop--------------------------------------//
app.post("/chillerDashboard/Average/chillarCOP/dateFiltered",async(req,res)=>{
  const {date}=req.body
  const chillarCOP=[]
  meterDb.query(`SELECT * FROM meterdata.chillarcopdaywise where date(timestamp)="${date}";`,function(error,result,feild){
    if(error){
      console.log(error)
    }
    else{
      const response=(JSON.parse(JSON.stringify(result)))
      for(let i=0;i<response.length;i++){
        let date=new Date(response[i].timestamp)
        const hours = date.getHours().toString().padStart(2, '0');
   const minutes = date.getMinutes().toString().padStart(2, '0');
   // const seconds = date.getSeconds().toString().padStart(2, '0');
   const timestamp = `${hours}:${minutes}`;
   chillarCOP.push({"polledTime":timestamp,"avg_c1cop":parseFloat(response[i].c1cop),"avg_c2cop":parseFloat(response[i].c2cop),"avg_c3cop":parseFloat(response[i].c3cop),"avg_c4cop":parseFloat(response[i].c4cop)})


    }
    console.log(chillarCOP.length)
      res.send(chillarCOP)

      
    }
  })
})

//----------------------------END of Average of C1 cop to C4 cop---------------------------------------//

//------------------------------------- evaporator and condensor flow rate dayWise value ----------------------//
app.post("/chillerDashboard/thermalinletoutlet/condenser/evaporator/dateFiltered/datapoints",async(req,res)=>{
  const {date}=req.body
  const thermalinletoutletData=[]
  meterDb.query(`SELECT * FROM thermalinletoutletdaywise where date(timestamp)="${date}"`,function(error,result,feild){
    if(error){
      console.log(error)
    }
    else{
      const response=(JSON.parse(JSON.stringify(result)))
      for(let i=0;i<response.length;i++){
        let date=new Date(response[i].timestamp)
        const hours = date.getHours().toString().padStart(2, '0');
   const minutes = date.getMinutes().toString().padStart(2, '0');
   // const seconds = date.getSeconds().toString().padStart(2, '0');
   const timestamp = `${hours}:${minutes}`;
   thermalinletoutletData.push({"polledTime":timestamp,"avg_commonHeaderFlowrate":parseFloat(response[i].avg_evaporator_instant_flow),"avg_condenserLineFlowrate":parseFloat(response[i].avg_condenser_instant_flow)})


    }
    console.log(thermalinletoutletData.length)
      res.send(thermalinletoutletData)

      
    }
  })
})
//-----------------------------------------end of evaporator and condensor flow rate dayWise value --------------//


//-------------------------------total Cooling of the day api--------------------------------------------//
app.post("/chillerDashboard/TotalCoolingEnergy/dateFilter",async(req,res)=>{
  const {date}=req.body
  const ChillerTotalCooling=[]
  meterDb.query(`SELECT * FROM meterdata.phase2tR where date(timestamp)="${date}";`,function(error,result,feild){
    if(error){
      console.log(error)
    }
    else{
      const response=(JSON.parse(JSON.stringify(result)))
      for(let i=0;i<response.length;i++){
        let date=new Date(response[i].timestamp)
        const hours = date.getHours().toString().padStart(2, '0');
   const minutes = date.getMinutes().toString().padStart(2, '0');
   // const seconds = date.getSeconds().toString().padStart(2, '0');
   const timestamp = `${hours}:${minutes}`;
   ChillerTotalCooling.push({"polledTime":timestamp,"TotalCoolingEnergy":Math.trunc(response[i].totalenergy)})


    }
    console.log(ChillerTotalCooling.length)
      res.send(ChillerTotalCooling)

      
    }
  })
})
//---------------------------------end of total Cooling of the day ---------------------------------------//
  //----------------------------------------END of chillerDashboard api`s  for date Filters----------------------------//

  //-------------------------------------tharmalStorage summary card---------------------//

  app.get("/thermal/summaryCard", async (req, res) => {
    try {
      const thermalWaterTemp = [];
  
      // Query the first database (con)
      const result1 = await conQuery("SELECT * FROM EMSThermalstorage WHERE DATE(received_time) = CURDATE() ORDER BY received_time DESC LIMIT 1;");
      const response1 = JSON.parse(JSON.stringify(result1));
      console.log(response1)
  
      for (let i = 0; i < response1.length; i++) {
        const date = new Date(response1[i].received_time);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const timestamp = `${hours}:${minutes}`;
  
        // Query the second database (chakradb)
        const result2 = await chakradbQuery("SELECT * FROM hvacChillerElectricPolling WHERE DATE(polledTime) = CURDATE() ORDER BY polledTime DESC LIMIT 1");
        const response2 = JSON.parse(JSON.stringify(result2));
        console.log(response1)
  
        // Process the data from both databases
        thermalWaterTemp.push({
          "polledTime": timestamp,
          "storedwatertemperature": parseFloat(response1[i].thermalstorage_storedwatertemperature),
          "inletTemparature":parseFloat(response1[i].thermalstorage_inlet),
          "outletTemparature":parseFloat(response1[i].thermalstorage_outlet),
          "thermalStoragelinepressure":response1[i].thermalstorage_linepressure,
          "flowrateToBuilding":parseFloat(response1[i].thermalstorage_to_buildingflowrate),
          "flowrateToTS":parseFloat(response1[i].building_to_thermalstorage_flowrate),
          "ActuvatorStatus":response1[i].actutator,
          "ADPvalveStatus":response1[i].adpvalve,
          "BDPvalveStatus":response1[i].bdpvalve,
          "HvalveStatus":response1[i].H_valve,
          "chargingPump1Power": parseFloat(response2[0].chargingPump1Power),
          "chargingPump2Power": parseFloat(response2[0].chargingPump2Power),
          "dischargingPump1Power": parseFloat(response2[0].dischargingPump1Power),
          "dischargingPump2Power": parseFloat(response2[0].dischargingPump2Power)
        });
      }
  
      res.send(thermalWaterTemp);
      console.log(thermalWaterTemp)
    } catch (error) {
      console.log(error);
      res.status(500).send("An error occurred");
    }
  });
  //----------------------------end of api-------------------------------------//


  //----------------------------battery shedule control api -----------------------//
  app.post('/Shedulecontroll/UPSBattery', function (req, res) {
    const resultValue = req.body;
    const insertPromises = [];
    console.log(resultValue)

    for (let i = 0; i < resultValue.length; i++) {
        const sql = `
            INSERT INTO batteryScheduler (weekDay, chgstart1, chgend1,chgstart2,chgend2, dchgstart1, dchgend1,dchgstart2,dchgend2)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                weekDay = VALUES(weekDay),
                chgstart1 = VALUES(chgstart1),
                chgend1 = VALUES(chgend1),
                chgstart2 = VALUES(chgstart2),
                chgend2 = VALUES(chgend2),
                dchgstart1 = VALUES(dchgstart1),
                dchgend1 = VALUES(dchgend1),
                dchgstart2 = VALUES(dchgstart2),
                dchgend2 = VALUES(dchgend2)
        `;

        const insertPromise = new Promise((resolve, reject) => {
            con.query(sql, [
                resultValue[i].seletedDay,
                resultValue[i].chargeStartTime,
                resultValue[i].chargeEndTime,
                resultValue[i].slot2ChargeStartTime,
                resultValue[i].slot2chargeEndTime,
                resultValue[i].DischargeStartTime,
                resultValue[i].DischargeEndTime,
                resultValue[i].slot2DischargeStartTime,
                resultValue[i].slot2DischargeEndTime
            ], function (error, results, fields) {
                if (error) {
                    reject(error);
                } else {
                    resolve(results);
                }
            });
        });

        insertPromises.push(insertPromise);
    }

    Promise.all(insertPromises)
        .then(() => {
            console.log("All records inserted/updated successfully");
            res.status(200).send('parameters added/updated successfully!');
        })
        .catch(error => {
            console.error("Error inserting/updating records:", error);
            res.status(500).send(error);
        });
});


  //---------------------end of api-----------------//




  app.get("/Thermal/Chillers/Status", async (req, res) => {
 
      const FinalData = [];
      EMSDB.query("SELECT * FROM ChillerHourlyStatus where date(polledTime)=curdate();",function(error,result,feild){
        if(error){
          console.log(error)
        }
        else{
          const response=(JSON.parse(JSON.stringify(result)))
          for (let i = 0; i < response.length; i++) {
            const date = new Date(response[i].polledTime);
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            const timestamp = `${hours}:${minutes}`;
      
            // Check if response2 has a valid element at index i
              FinalData.push({
                "polledTime": timestamp,
                "chiller1Status": parseInt(response[i].chiller1),
                "chiller2Status": parseInt(response[i].chiller2),
                "chiller3Status": parseInt(response[i].chiller3),
                "chiller4Status": parseInt(response[i].chiller4),
                "chiller5Status": parseInt(response[i].chiller5),
                "chiller6Status": parseInt(response[i].chiller6),
                "chiller7Status": parseInt(response[i].chiller7),
                "chiller8Status":parseInt(response[i].chiller8),
                "ThermalCHGStatus": parseInt(response[i].tsCharge),
                "thermalDCHGStatus": parseInt((response[i].tsDischarge)),
              });
          }
      
          console.log(FinalData);
          res.send(FinalData);

        }
      })

  });


  app.post("/Thermal/Chillers/Status/datefilters", async (req, res) => {
    const { date } = req.body;
    const FinalData = [];
      EMSDB.query(`SELECT * FROM ChillerHourlyStatus where date(polledTime)='${date}';`,function(error,result,feild){
        if(error){
          console.log(error)
        }
        else{
          const response=(JSON.parse(JSON.stringify(result)))
          for (let i = 0; i < response.length; i++) {
            const date = new Date(response[i].polledTime);
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            const timestamp = `${hours}:${minutes}`;
      
            // Check if response2 has a valid element at index i
              FinalData.push({
                "polledTime": timestamp,
                "chiller1Status": parseInt(response[i].chiller1),
                "chiller2Status": parseInt(response[i].chiller2),
                "chiller3Status":parseInt(response[i].chiller3),
                "chiller4Status": parseInt(response[i].chiller4),
                "chiller5Status": parseInt(response[i].chiller5),
                "chiller6Status": parseInt(response[i].chiller6),
                "chiller7Status": parseInt(response[i].chiller7),
                "chiller8Status": parseInt(response[i].chiller8),
                "ThermalCHGStatus": parseInt(response[i].tsCharge),
                "thermalDCHGStatus": parseInt((response[i].tsDischarge)),
              });
          }
      
          console.log(FinalData);
          res.send(FinalData);

        }
      })
  });

  //------------------------lto battery data api----------------------------------------------//
  app.get("/battery/lto",async(req,res)=>{
    const BatteryValue=[]
    unprocesseddata.query("SELECT * FROM ltoBatteryData where date(recordTimestamp)=curdate() order by recordTimestamp desc limit 1 ;",function(err,result,feilds){
           if(err){
               console.log(err)
           }
           else{
               const response=(JSON.parse(JSON.stringify(result)))
               for(let i=0;i<response.length;i++){
                let date = new Date(response[i].recordTimestamp);
                //const timeVal=date.toLocaleDateString()
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            const seconds = date.getSeconds().toString().padStart(2, '0');
            const timestampVal = `${hours}:${minutes}:${seconds}`;
            BatteryValue.push({"polledTime":timestampVal,"batteryVoltage":response[i].batteryVoltage,"batteryCurrent":response[i].batteryCurrent,"mainContactorStatus":response[i].mainContactorStatus,"prechargeContactorStatus":response[i].prechargeContactorStatus,"batteryStatus":response[i].batteryStatus,"packSOC":response[i].packSOC,"packUsableSOC":response[i].packUsableSOC})

               }
               res.send(BatteryValue)
               console.log(BatteryValue)
           }
       })


      
  })
  //------------------------------  END OF API---------------------------------------------------//

  //-------------------------------------IOE battery  summary api ----------------------------------//
  app.get("/battery/IOE",async(req,res)=>{
    const BatteryValue=[]
    EMSDB.query("SELECT * FROM EMS.ioeBatteryData where date(recordTimestamp)=curdate() order by  recordTimestamp desc limit 1;",function(err,result,feilds){
           if(err){
               console.log(err)
           }
           else{
               const response=(JSON.parse(JSON.stringify(result)))
               for(let i=0;i<response.length;i++){
                let date = new Date(response[i].recordTimestamp);
                //const timeVal=date.toLocaleDateString()
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            const seconds = date.getSeconds().toString().padStart(2, '0');
            const timestampVal = `${hours}:${minutes}:${seconds}`;
            let status="IDLE"
            response[i].batteryStatus==="CHG"?status="CHARGING":status="DISCHARGING"
            BatteryValue.push({"polledTime":timestampVal,"batteryVoltage":response[i].batteryVoltage,"batteryCurrent":response[i].batteryCurrent,"mainContactorStatus":response[i].mainContactorStatus,"prechargeContactorStatus":response[i].prechargeContactorStatus,"batteryStatus":status,"packSOC":response[i].packSOC,"packUsableSOC":response[i].packUsableSOC})

               }
               res.send(BatteryValue)
               console.log(BatteryValue)
           }
       })


      
  })
  //----------------------------------------end of api------------------------------------------------//

  //----------------------------LTOLTOBattery instantanious controll-----------------------------------//
  app.post('/LTOBattery/controll', function (req, res) {

    const currentTime = new Date();

// Use the toLocaleString method with the timeZone option
const options = { timeZone: tz };
const timestamp = currentTime.toLocaleString('en-US', options);

// Parse the timestamp into a Date object
const timestampDate = new Date(timestamp);

// Format the timestamp in MySQL datetime format
const year = timestampDate.getFullYear();
const month = (timestampDate.getMonth() + 1).toString().padStart(2, '0');
const day = timestampDate.getDate().toString().padStart(2, '0');
const hours = timestampDate.getHours().toString().padStart(2, '0');
const minutes = timestampDate.getMinutes().toString().padStart(2, '0');
const seconds = timestampDate.getSeconds().toString().padStart(2, '0');

const mysqlTimestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
console.log(mysqlTimestamp);

    const { functionCode, controlStatus} = req.body;
    console.log(req.body)
    const sql = 'INSERT INTO ltoInstantControl (functionCode, controlStatus,recordTime) VALUES (?, ?, ?)';
    EMSDB.query(sql, [functionCode, controlStatus,mysqlTimestamp], function (error, results, fields) {
        if (error) {
            return res.status(500).send(error);
        }
        else{
            console.log(results)
            res.status(200).send('parameter  added successfully!');
        }
        //return
    });
});
  //-------------------------------END OF API----------------------------------------------//
  

  //--------------------------------lto dashboard graph initial graph----------------------------//
  app.get("/dashboard/LTOBattery",async(req,res)=>{
    const resultValue=[]
    let  idleState=""
    con.query("select * from LTObatteryHourly where date(polledTime) = curdate();",function(err,result,feilds){
     // DATE_SUB(CURDATE(), INTERVAL 1 DAY)  
      if(err){
            console.log(err)
        }
        else{
            const response=(JSON.parse(JSON.stringify(result)))
            for(let i=0;i<response.length;i++){
              let date = new Date(response[i].polledTime);
              const hours = date.getHours().toString().padStart(2, '0');
              const minutes = date.getMinutes().toString().padStart(2, '0');
              // const seconds = date.getSeconds().toString().padStart(2, '0');
              const timestamp = `${hours}:${minutes}`;
              if(response[i].chargingEnergy==null && response[i].dischargingEnergy==null){
                idleState=0.1
              }
              else{
                idleState=0
              }
              resultValue.push({"PolledTime":timestamp,"chargingEnergy":parseFloat(response[i].chargingEnergy),"dischargingEnergy":parseFloat(response[i].dischargingEnergy),"idleEnergy":parseFloat(idleState),"Pacsoc":parseInt(response[i].packsoc),"energy_available":response[i].energyAvailable})

            }
            res.send(resultValue)
            console.log(resultValue.length)
        }
    })
    
})
  //-------------------------------------------END OF API----------------------------------------//
  

  //-------------------------------------LTO perminute current/voltage api------------------------//
  app.get("/current_VS_voltage/LTOBattery",async(req,res)=>{
    const resultValue=[]
    unprocesseddata.query("SELECT * FROM ltoBatteryData where date(recordTimestamp)=curdate() GROUP BY DATE_FORMAT(recordTimestamp, '%Y-%m-%d %H:%i') ;",function(err,result,feilds){
     // DATE_SUB(CURDATE(), INTERVAL 1 DAY)  
      if(err){
            console.log(err)
        }
        else{
            const response=(JSON.parse(JSON.stringify(result)))
            for(let i=0;i<response.length;i++){
              let date = new Date(response[i].recordTimestamp);
              const hours = date.getHours().toString().padStart(2, '0');
              const minutes = date.getMinutes().toString().padStart(2, '0');
              // const seconds = date.getSeconds().toString().padStart(2, '0');
              const timestamp = `${hours}:${minutes}`;
              resultValue.push({"PolledTime":timestamp,"BatteryVoltage":parseFloat(response[i].batteryVoltage),"BatteryCurrent":parseFloat(response[i].batteryCurrent)})

            }
            res.send(resultValue)
            console.log(resultValue.length)
        }
    })
    
})
  //--------------------------------------END of api---------------------------------------------//

  //------------------------------------------LTO perminute filtered graph api-----------------------//
  app.post("/current_VS_voltage/LTOBattery/filtered",async(req,res)=>{
    const {date}=req.body
    const resultValue=[]
    unprocesseddata.query(`SELECT * FROM ltoBatteryData where date(recordTimestamp)='${date}' GROUP BY DATE_FORMAT(recordTimestamp, '%Y-%m-%d %H:%i')`,function(err,result,feilds){
     // DATE_SUB(CURDATE(), INTERVAL 1 DAY)  
      if(err){
            console.log(err)
        }
        else{
            const response=(JSON.parse(JSON.stringify(result)))
            for(let i=0;i<response.length;i++){
              let date = new Date(response[i].recordTimestamp);
              const hours = date.getHours().toString().padStart(2, '0');
              const minutes = date.getMinutes().toString().padStart(2, '0');
              // const seconds = date.getSeconds().toString().padStart(2, '0');
              const timestamp = `${hours}:${minutes}`;
              resultValue.push({"PolledTime":timestamp,"BatteryVoltage":parseFloat(response[i].batteryVoltage),"BatteryCurrent":parseFloat(response[i].batteryCurrent)})

            }
            res.send(resultValue)
            console.log(resultValue.length)
        }
    })
    
})
  //------------------------------------------- END of api--------------------------------------------//


  //-----------------------------------lto 5 min energy vs packsoc api--------------------------------//

  app.get("/Ltoanalytics/energy_VS_packsoc", async (req, res) => {
    const {date}=req.body
    unprocesseddata.query("SELECT * FROM ltoBatteryData where date(recordTimestamp)=curdate() GROUP BY DATE_FORMAT(recordTimestamp, '%Y-%m-%d %H:%i')", function (error, result) {
      
      const batteryData = [];
      const energy = [];
      const packsoc = [];
      const timestamp = [];
      const resultData=[]
  
      if (error) {
        console.log(error);
      } else {
        const response = JSON.parse(JSON.stringify(result));
        for (let i = 0; i < response.length; i++) {
          if (response[i].packSOC) {
            if (response[i].batteryStatus==="IDLE") {
              //energy.push(response[i].idle_energystatues);
              packsoc.push(response[i].packSOC);
              let date = new Date(response[i].recordTimestamp);
              const hours = date.getHours().toString().padStart(2, '0');
              const minutes = date.getMinutes().toString().padStart(2, '0');
              // const seconds = date.getSeconds().toString().padStart(2, '0');
              const timestamp = `${hours}:${minutes}`;
              //timestamp.push(date);
              resultData.push({"packsoc":parseInt(response[i].packSOC),"batteryEnergy":0.01,"timestamp":timestamp,"batteryStatus":response[i].batteryStatus})

            }
            if (response[i].batteryStatus==="DCHG") {
              energy.push((response[i].dischargingEnergy)*-1);
              packsoc.push(response[i].packSOC);
              let date = new Date(response[i].recordTimestamp);
              const hours = date.getHours().toString().padStart(2, '0');
              const minutes = date.getMinutes().toString().padStart(2, '0');
              // const seconds = date.getSeconds().toString().padStart(2, '0');
              const timestamp = `${hours}:${minutes}`;
              //timestamp.push(date);
              resultData.push({"packsoc":parseInt(response[i].packSOC),"batteryEnergy":parseFloat((response[i].dischargingEnergy/100)*-1),"timestamp":timestamp,"batteryStatus":"Discharging"})
            }
            if (response[i].batteryStatus==="CHG") {
              energy.push(response[i].chargingEnergy);
              packsoc.push(response[i].packSOC);
              let date = new Date(response[i].recordTimestamp);
              const hours = date.getHours().toString().padStart(2, '0');
              const minutes = date.getMinutes().toString().padStart(2, '0');
              // const seconds = date.getSeconds().toString().padStart(2, '0');
              const timestamp = `${hours}:${minutes}`;
              //timestamp.push(date);

              resultData.push({"packsoc":parseInt(response[i].packSOC),"batteryEnergy":parseFloat(response[i].chargingEnergy/100),"timestamp":timestamp,"batteryStatus":"Charging"})
            }
          }
        }
  
  
        res.send(resultData);
        console.log(result.length)
      }
    });
  });
  //-----------------------------------END of api------------------------------------------------------//


  //----------------------------------LTO 5min energy vs pacsoc filtered api---------------------//
  app.post("/Ltoanalytics/energy_VS_packsoc/DateFilter", async (req, res) => {
    const {date}=req.body
    unprocesseddata.query(`SELECT * FROM ltoBatteryData where date(recordTimestamp)='${date}' GROUP BY DATE_FORMAT(recordTimestamp, '%Y-%m-%d %H:%i')`, function (error, result) {
      
      const batteryData = [];
      const energy = [];
      const packsoc = [];
      const timestamp = [];
      const resultData=[]
  
      if (error) {
        console.log(error);
      } else {
        const response = JSON.parse(JSON.stringify(result));
        for (let i = 0; i < response.length; i++) {
          if (response[i].packSOC) {
            if (response[i].batteryStatus==="IDLE") {
              //energy.push(response[i].idle_energystatues);
              packsoc.push(response[i].max_pacsoc);
              let date = new Date(response[i].recordTimestamp);
              const hours = date.getHours().toString().padStart(2, '0');
              const minutes = date.getMinutes().toString().padStart(2, '0');
              // const seconds = date.getSeconds().toString().padStart(2, '0');
              const timestamp = `${hours}:${minutes}`;
              //timestamp.push(date);
              resultData.push({"packsoc":parseInt(response[i].packSOC),"batteryEnergy":0.01,"timestamp":timestamp,"batteryStatus":response[i].batteryStatus})

            }

            if (response[i].batteryStatus==="DCHG") {
              energy.push((response[i].dischargingEnergy));
              packsoc.push(response[i].packSOC);
              let date = new Date(response[i].recordTimestamp);
              const hours = date.getHours().toString().padStart(2, '0');
              const minutes = date.getMinutes().toString().padStart(2, '0');
              // const seconds = date.getSeconds().toString().padStart(2, '0');
              const timestamp = `${hours}:${minutes}`;
              //timestamp.push(date);
              resultData.push({"packsoc":parseInt(response[i].packSOC),"batteryEnergy":parseFloat((response[i].dischargingEnergy))*-1,"timestamp":timestamp,"batteryStatus":"Discharging"})
            }

            if (response[i].batteryStatus==="CHG") {
              energy.push(response[i].chargingEnergy);
              packsoc.push(response[i].packSOC);
              let date = new Date(response[i].recordTimestamp);
              const hours = date.getHours().toString().padStart(2, '0');
              const minutes = date.getMinutes().toString().padStart(2, '0');
              // const seconds = date.getSeconds().toString().padStart(2, '0');
              const timestamp = `${hours}:${minutes}`;
              //timestamp.push(date);

              resultData.push({"packsoc":parseInt(response[i].packSOC),"batteryEnergy":parseFloat(response[i].chargingEnergy),"timestamp":timestamp,"batteryStatus":"Charging"})
            }
          }
        }
  
  
        res.send(resultData);
        console.log(result.length)
      }
    });
  });
  //---------------------------------- END of api-----------------------------------------------//
  
  //--------------------------------------lto dashboard date filter data api -----------------------//
    app.post("/dashboard/dateFilter/LTOBattery",async(req,res)=>{
    const {date}=req.body
    const resultValue=[]
    let  idleState=""
    con.query(`select * from LTObatteryHourly where date(polledTime) = '${date}'`,function(err,result,feilds){

     // DATE_SUB(CURDATE(), INTERVAL 1 DAY)  
      if(err){
            console.log(err)
        }

        else{
            const response=(JSON.parse(JSON.stringify(result)))
             for(let i=0;i<response.length;i++){
              let date = new Date(response[i].polledTime);
              const hours = date.getHours().toString().padStart(2, '0');
              const minutes = date.getMinutes().toString().padStart(2, '0');
              // const seconds = date.getSeconds().toString().padStart(2, '0');
              const timestamp = `${hours}:${minutes}`;
              if(response[i].chargingEnergy==null && response[i].dischargingEnergy==null){
                idleState=0.1
              }
              else{
                idleState=0
              }
              resultValue.push({"PolledTime":timestamp,"chargingEnergy":parseFloat(response[i].chargingEnergy),"dischargingEnergy":parseFloat(response[i].dischargingEnergy),"idleEnergy":parseFloat(idleState),"Pacsoc":parseInt(response[i].packsoc),"energy_available":response[i].energyAvailable})

            }
            res.send(resultValue)
            console.log(resultValue.length)
        }
    })
    
})
  //------------------------------------------------END OF API----------------------------------//


  //-------------------------------PeakDemand analysis dashboard api---------------------------------//
  app.get("/PeakDemand/Dashboard/Analysis",async(req,res)=>{
    const PeakDemandDetails = [];
    const MaxPeakDemand = [];
    let MaxDemand = 0;
    let Time = "";
    let CountLevel1 = 0;
    let CountLevel2 = 0;
    let CountLevel3 = 0;
    let CountLevel4 = 0;
    let CountLevel5 = 0;
    let CountLevel6 = 0;
    let CountAboveLimit = 0;
    let CountBellowLimit = 0;
    let SumOfEnergy = 0;
    let Percentage = 0;
    const differences = [];
    let LevelWisePercentage = [];
    let CountLevecrossLimit1_4100To4200_Percentage = 0;
    let CountLevecrossLimit1_4200To4300_Percentage = 0;
    let CountLevecrossLimit1_4300To4400_Percentage = 0;
    let CountLevecrossLimit1_4400To4500_Percentage = 0;
    let CountLevecrossLimit1_4500To4600_Percentage = 0;
    let CountLevecrossLimit1_4600_Percentage = 0;
    let CountRangeof_4100_Above_Below = [0, 0];
    let CountRangeof_4200_Above_Below = [0, 0];
    let CountRangeof_4300_Above_Below = [0, 0];
    let CountRangeof_4400_Above_Below = [0, 0];
    let CountRangeof_4500_Above_Below = [0, 0];
    let CountBellowLimitPercentage = 0;
    let CountAboveLimitPercentage = 0;
  
    // Initialize the variables here
    CountBellowLimitPercentage = 0;
    CountAboveLimitPercentage = 0;
    chakradb.query("SELECT * FROM bmsmgmt_olap_prod_v13.hvacSchneider7230Polling where date(polledTime)=curdate()  AND  TIME(polledTime) BETWEEN '09:00:00' AND '19:00:00'",function(err,result,feilds){
    //chakradb.query(`SELECT * FROM bmsmgmt_olap_prod_v13.hvacSchneider7230Polling where date(polledTime)='${date}'  AND  TIME(polledTime) BETWEEN '09:00:00' AND '19:00:00'`
      //SELECT * FROM bmsmgmt_olap_prod_v13.hvacSchneider7230Polling where date(polledTime)=curdate()  AND  TIME(polledTime) BETWEEN '09:00:00' AND '19:00:00' order by polledTime desc 
           if(err){
               console.log(err)
           }
           else{
               const response=(JSON.parse(JSON.stringify(result)))
                           // Initialize the variables here
            CountBellowLimitPercentage = 0;
            CountAboveLimitPercentage = 0;

               for(let i=0;i<response.length;i++){
                let date = new Date(response[i].polledTime);
                //const timeVal=date.toLocaleDateString()
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            const seconds = date.getSeconds().toString().padStart(2, '0');
            const timestampVal = `${hours}:${minutes}:${seconds}`;
            
          //----------------value range wise above and below---------------------------// 
            if(response[i].totalApparentPower2>=4100){
              CountRangeof_4100_Above_Below[0]+=1
  
            } 
            if(response[i].totalApparentPower2<4100){
              CountRangeof_4100_Above_Below[1]+=1
  
            }
            if(response[i].totalApparentPower2>=4200){
              CountRangeof_4200_Above_Below[0]+=1
            }
  
            if(response[i].totalApparentPower2<4200){
              CountRangeof_4200_Above_Below[1]+=1
            }
            if(response[i].totalApparentPower2>=4300){
              CountRangeof_4300_Above_Below[0]+=1
            }
            
            if(response[i].totalApparentPower2<4300){
              CountRangeof_4300_Above_Below[1]+=1
            }
            if(response[i].totalApparentPower2>=4400){
              CountRangeof_4400_Above_Below[0]+=1
            }
            
            if(response[i].totalApparentPower2<4400){
              CountRangeof_4400_Above_Below[1]+=1
            }
            if(response[i].totalApparentPower2>=4500){
              CountRangeof_4500_Above_Below[0]+=1
            }
            
            if(response[i].totalApparentPower2<4500){
              CountRangeof_4500_Above_Below[1]+=1
            }

            //-------------------end of value range wise above and below--------------------------//
            
            if(response[i].totalApparentPower2>=4100 && response[i].totalApparentPower2<4200){
              CountLevel1+=1
            }
            if(response[i].totalApparentPower2>=4200 && response[i].totalApparentPower2<4300){
              CountLevel2+=1
            }
            if(response[i].totalApparentPower2>=4300 && response[i].totalApparentPower2<4400){
              CountLevel3+=1
            }
            if(response[i].totalApparentPower2>=4400 && response[i].totalApparentPower2<4500){
              CountLevel4+=1
            }
            if(response[i].totalApparentPower2>=4500 && response[i].totalApparentPower2<4600){
              CountLevel5+=1
            }
            if(response[i].totalApparentPower2>=4600 && response[i].totalApparentPower2<4700){
              CountLevel6+=1
            }
            if(response[i].totalApparentPower2>=4100 ){
              CountAboveLimit+=1
            }
            if(response[i].totalApparentPower2<4100){
              CountBellowLimit+=1
            }


            CountLevecrossLimit1_4100To4200_Percentage=(CountLevel1/response.length)*100
            CountLevecrossLimit1_4200To4300_Percentage=(CountLevel2/response.length)*100
            CountLevecrossLimit1_4300To4400_Percentage=(CountLevel3/response.length)*100
            CountLevecrossLimit1_4400To4500_Percentage=(CountLevel4/response.length)*100
            CountLevecrossLimit1_4500To4600_Percentage=(CountLevel5/response.length)*100
            CountLevecrossLimit1_4600_Percentage=(CountLevel6/response.length)*100
            CountBellowLimitPercentage=(CountBellowLimit/response.length)*100
            CountAboveLimitPercentage=(CountAboveLimit/response.length)*100

            LevelWisePercentage.push({
              "Time":timestampVal,
              "CountLevecrossLimit1_4100To4200_Percentage":CountLevecrossLimit1_4100To4200_Percentage,
              "CountLevecrossLimit1_4200To4300_Percentage":CountLevecrossLimit1_4200To4300_Percentage,
              "CountLevecrossLimit1_4300To4400_Percentage":CountLevecrossLimit1_4300To4400_Percentage,
              "CountLevecrossLimit1_4400To4500_Percentage":CountLevecrossLimit1_4400To4500_Percentage,
              "CountLevecrossLimit1_4500To4600_Percentage":CountLevecrossLimit1_4500To4600_Percentage,
              "CountLevecrossLimit1_4600_Percentage":CountLevecrossLimit1_4600_Percentage,
              
             })

           

            

          
           //---------------calculate MAX demand value--------------------------//
            if(response[i].totalApparentPower2 > MaxDemand){
              MaxDemand=Math.round(response[i].totalApparentPower2)
              Time=timestampVal
            }
            
         

         


           
            //PeakDemandDetails.push({"polledTime":timestampVal,"MaxDemand":MaxDemand,"peaddemand":response[i].peakDemand})

               }

               // Loop through the peak demand values starting from the second element
               for (let i = 1; i < response.length; i++) {
                if (response[i].totalApparentPower2 !== null) {
                  // Calculate the difference between the current and previous peak demand values
                  const difference = Math.abs(parseFloat(response[i].totalApparentPower2) - parseFloat(response[i - 1].totalApparentPower2));
                  
                  // Store the difference in the array
                  differences.push(difference);
                }
              }
           
              let countLevelZero_Fivety=0
              let countLeve2Fivety_Hundred=0
              let countLeve3Hundred_oneFivety=0
              let countLeve4oneFivety_twohundred=0
              let countLeve5twohundred_twoFifty=0
              let countLeve6twoFifty=0

              for (let i=0;i<differences.length;i++){

                if(differences[i]>0 && differences[i]<50 ){
                  countLevelZero_Fivety+=1
                }
                if(differences[i]>=50 && differences[i]<100 ){
                  countLeve2Fivety_Hundred+=1
                }
                if(differences[i]>=100 && differences[i]<150 ){
                  countLeve3Hundred_oneFivety+=1
                }
                if(differences[i]>=150 && differences[i]<200 ){
                  countLeve4oneFivety_twohundred+=1
                }
                if(differences[i]>=200 && differences[i]<250 ){
                  countLeve5twohundred_twoFifty+=1
                }
                if(differences[i]>=250){
                  countLeve6twoFifty+=1
                }


              }

              let countLevelZero_FivetyPercentage=(countLevelZero_Fivety/response.length)*100
              let countLevel2Fivety_HundredPercentage=(countLeve2Fivety_Hundred/response.length)*100
              let countLevel3Hundred_oneFivetyPercentage=(countLeve3Hundred_oneFivety/response.length)*100
              let countLeve4oneFivety_twohundredPercentage=(countLeve4oneFivety_twohundred/response.length)*100
              let countLeve5twohundred_twoFiftyPercentage=(countLeve5twohundred_twoFifty/response.length)*100
              let countLeve6twoFiftyPercentage=(countLeve6twoFifty/response.length)*100


               
               
               //console.log(countLevelZero_Fivety,countLeve2Fivety_Hundred,countLeve3Hundred_oneFivety,countLeve4oneFivety_twohundred)
               
               //console.log(MaxDemand,Time,CountLevel1,CountLevel2,CountLevel3,CountLevel4,CountLevel5,CountLevel6,CountAboveLimit,CountBellowLimit,SumOfEnergy,CountBellowLimitPercentage,CountAboveLimitPercentage)
               console.log( ` total length of the response is ${response.length}`)
               PeakDemandDetails.push({
                "maxDemand":MaxDemand,
                "MaxDemandTime":Time,
                "totalLength":response.length,
                "CountLevecrossLimit1_4100To4200":CountLevel1,
                "CountLevecrossLimit2_4200To4300":CountLevel2,
                "CountLevecrossLimit3_4300To4400":CountLevel3,
                "CountLevecrossLimit4_4400To4500":CountLevel4,
                "CountLevecrossLimit5_4500To4600":CountLevel5,
                "CountLevecrossLimit6_4600":CountLevel6,
                "CountLevecrossLimit1_4100To4200_Percentage":CountLevecrossLimit1_4100To4200_Percentage,
                "CountAbove_4100":CountAboveLimit,
                "CountBellow_4100":CountBellowLimit,
                "CountAbovePercentage_4100": CountAboveLimitPercentage !== null && CountAboveLimitPercentage !== undefined ? parseFloat((CountAboveLimitPercentage).toFixed(2)) : 0,
                "countBellowPercentage_4100":CountBellowLimitPercentage == null || 0 ? 0: parseFloat((CountBellowLimitPercentage).toFixed(2)),
                "countLevelZero_Fivety":countLevelZero_Fivety,
                "countLeve2Fivety_Hundred":countLeve2Fivety_Hundred,
                "countLeve3Hundred_oneFivety":countLeve3Hundred_oneFivety,
                "countLeve4oneFivety_twohundred":countLeve4oneFivety_twohundred,
                "countLeve5twohundred_twoFifty":countLeve5twohundred_twoFifty,
                "countLeve6twoFifty":countLeve6twoFifty,
                "countLevelZero_FivetyPercentage":countLevelZero_FivetyPercentage == null || 0 ? 0: parseFloat((countLevelZero_FivetyPercentage).toFixed(2)),
                "countLevel2Fivety_HundredPercentage":countLevel2Fivety_HundredPercentage == null || 0? 0: parseFloat((countLevel2Fivety_HundredPercentage).toFixed(2)),
                "countLevel3Hundred_oneFivetyPercentage":countLevel3Hundred_oneFivetyPercentage == null || 0 ? 0:parseFloat((countLevel3Hundred_oneFivetyPercentage).toFixed(2)),
                "countLeve4oneFivety_twohundredPercentage":countLeve4oneFivety_twohundredPercentage == null || 0 ? 0:parseFloat((countLeve4oneFivety_twohundredPercentage).toFixed(2)),
                "countLeve5twohundred_twoFiftyPercentage":countLeve5twohundred_twoFiftyPercentage ==  null || 0 ? 0:parseFloat((countLeve5twohundred_twoFiftyPercentage).toFixed(2)),
                "countLeve6twoFiftyPercentage":countLeve6twoFiftyPercentage == null || 0 ? 0:parseFloat((countLeve6twoFiftyPercentage).toFixed(2)),
                "LevelWisePercentage":LevelWisePercentage,
                "CountRangeof_4100_Above_Below":CountRangeof_4100_Above_Below,
                "CountRangeof_4200_Above_Below":CountRangeof_4200_Above_Below,
                "CountRangeof_4300_Above_Below":CountRangeof_4300_Above_Below,
                "CountRangeof_4400_Above_Below":CountRangeof_4400_Above_Below,
                "CountRangeof_4500_Above_Below":CountRangeof_4500_Above_Below
              })
              console.log(LevelWisePercentage.length)
              console.log(CountAboveLimitPercentage,CountBellowLimitPercentage),
              res.send(PeakDemandDetails)

           }
       })


      
  })

  //---------------------------------END of api------------------------------------------------------//

//------------------------------------PeakDemand Analysis filtered data------------------------------//
app.post("/PeakDemand/Dashboard/Analysis/DateFiltered",async(req,res)=>{
  const {date}=req.body
  const PeakDemandDetails=[]
  const MaxPeakDemand=[]
  console.log(date)
  let MaxDemand=0
  let Time=""
  let CountLevel1=0
  let CountLevel2=0
  let CountLevel3=0
  let CountLevel4=0
  let CountLevel5=0
  let CountLevel6=0
  let CountAboveLimit=0
  let CountBellowLimit=0
  let SumOfEnergy=0
  let Percentage=0
  const differences = [];
  let LevelWisePercentage=[]
  let CountLevecrossLimit1_4100To4200_Percentage=0
  let CountLevecrossLimit1_4200To4300_Percentage=0
  let CountLevecrossLimit1_4300To4400_Percentage=0
  let CountLevecrossLimit1_4400To4500_Percentage=0
  let CountLevecrossLimit1_4500To4600_Percentage=0
  let CountLevecrossLimit1_4600_Percentage=0
  let CountRangeof_4100_Above_Below=[0,0]
  let CountRangeof_4200_Above_Below=[0,0]
  let CountRangeof_4300_Above_Below=[0,0]
  let CountRangeof_4400_Above_Below=[0,0]
  let CountRangeof_4500_Above_Below=[0,0] 
  let CountBellowLimitPercentage = 0;
    let CountAboveLimitPercentage = 0;
  
    // Initialize the variables here
    CountBellowLimitPercentage = 0;
    CountAboveLimitPercentage = 0;
  
  // let CountBellowLimitPercentage=0
  // let CountAboveLimitPercentage=0
  chakradb.query(`SELECT * FROM bmsmgmt_olap_prod_v13.hvacSchneider7230Polling where date(polledTime)='${date}'  AND  TIME(polledTime) BETWEEN '09:00:00' AND '19:00:00'`,function(err,result,feilds){
    //SELECT * FROM bmsmgmt_olap_prod_v13.hvacSchneider7230Polling where date(polledTime)=curdate()  AND  TIME(polledTime) BETWEEN '09:00:00' AND '19:00:00' order by polledTime desc 
         if(err){
             console.log(err)
         }
         else{
             const response=(JSON.parse(JSON.stringify(result)))
             for(let i=0;i<response.length;i++){
              let date = new Date(response[i].polledTime);
              //const timeVal=date.toLocaleDateString()
          const hours = date.getHours().toString().padStart(2, '0');
          const minutes = date.getMinutes().toString().padStart(2, '0');
          const seconds = date.getSeconds().toString().padStart(2, '0');
          const timestampVal = `${hours}:${minutes}:${seconds}`;



          //------------------------value range wise above and below ------------------------------//
          if(response[i].totalApparentPower2>=4100){
            CountRangeof_4100_Above_Below[0]+=1

          } 
          if(response[i].totalApparentPower2<4100){
            CountRangeof_4100_Above_Below[1]+=1

          }
          if(response[i].totalApparentPower2>=4200){
            CountRangeof_4200_Above_Below[0]+=1
          }

          if(response[i].totalApparentPower2<4200){
            CountRangeof_4200_Above_Below[1]+=1
          }
          if(response[i].totalApparentPower2>=4300){
            CountRangeof_4300_Above_Below[0]+=1
          }
          
          if(response[i].totalApparentPower2<4300){
            CountRangeof_4300_Above_Below[1]+=1
          }
          if(response[i].totalApparentPower2>=4400){
            CountRangeof_4400_Above_Below[0]+=1
          }
          
          if(response[i].totalApparentPower2<4400){
            CountRangeof_4400_Above_Below[1]+=1
          }
          if(response[i].totalApparentPower2>=4500){
            CountRangeof_4500_Above_Below[0]+=1
          }
          
          if(response[i].totalApparentPower2<4500){
            CountRangeof_4500_Above_Below[1]+=1
          }

          //--------------------end of range wise above of below ----------------------------//
      
          if(response[i].totalApparentPower2>=4100 && response[i].totalApparentPower2<4200){
            CountLevel1+=1
          }
          if(response[i].totalApparentPower2>=4200 && response[i].totalApparentPower2<4300){
            CountLevel2+=1
          }
          if(response[i].totalApparentPower2>=4300 && response[i].totalApparentPower2<4400){
            CountLevel3+=1
          }
          if(response[i].totalApparentPower2>=4400 && response[i].totalApparentPower2<4500){
            CountLevel4+=1
          }
          if(response[i].totalApparentPower2>=4500 && response[i].totalApparentPower2<4600){
            CountLevel5+=1
          }
          if(response[i].totalApparentPower2>=4600 && response[i].totalApparentPower2<4700){
            CountLevel6+=1
          }
          if(response[i].totalApparentPower2>=4100 ){
            CountAboveLimit+=1
          }
          if(response[i].totalApparentPower2<4100){
            CountBellowLimit+=1
          }


          CountLevecrossLimit1_4100To4200_Percentage=(CountLevel1/response.length)*100
          CountLevecrossLimit1_4200To4300_Percentage=(CountLevel2/response.length)*100
          CountLevecrossLimit1_4300To4400_Percentage=(CountLevel3/response.length)*100
          CountLevecrossLimit1_4400To4500_Percentage=(CountLevel4/response.length)*100
          CountLevecrossLimit1_4500To4600_Percentage=(CountLevel5/response.length)*100
          CountLevecrossLimit1_4600_Percentage=(CountLevel6/response.length)*100

          LevelWisePercentage.push({
            "Time":timestampVal,
            "CountLevecrossLimit1_4100To4200_Percentage":CountLevecrossLimit1_4100To4200_Percentage,
            "CountLevecrossLimit1_4200To4300_Percentage":CountLevecrossLimit1_4200To4300_Percentage,
            "CountLevecrossLimit1_4300To4400_Percentage":CountLevecrossLimit1_4300To4400_Percentage,
            "CountLevecrossLimit1_4400To4500_Percentage":CountLevecrossLimit1_4400To4500_Percentage,
            "CountLevecrossLimit1_4500To4600_Percentage":CountLevecrossLimit1_4500To4600_Percentage,
            "CountLevecrossLimit1_4600_Percentage":CountLevecrossLimit1_4600_Percentage,
           })

           CountBellowLimitPercentage=(CountBellowLimit/response.length)*100
          CountAboveLimitPercentage=(CountAboveLimit/response.length)*100

         

          

          

         //---------------calculate MAX demand value--------------------------//
          if(response[i].totalApparentPower2 > MaxDemand){
            MaxDemand=Math.round(response[i].totalApparentPower2)
            Time=timestampVal
          }
          
          

       


         
          //PeakDemandDetails.push({"polledTime":timestampVal,"MaxDemand":MaxDemand,"peaddemand":response[i].peakDemand})

             }

             // Loop through the peak demand values starting from the second element
             for (let i = 1; i < response.length; i++) {
              if (response[i].totalApparentPower2 !== null) {
                // Calculate the difference between the current and previous peak demand values
                const difference = Math.abs(parseFloat(response[i].totalApparentPower2) - parseFloat(response[i - 1].totalApparentPower2));
                
                // Store the difference in the array
                differences.push(difference);
              }
            }
         
            let countLevelZero_Fivety=0
            let countLeve2Fivety_Hundred=0
            let countLeve3Hundred_oneFivety=0
            let countLeve4oneFivety_twohundred=0
            let countLeve5twohundred_twoFifty=0
            let countLeve6twoFifty=0

            for (let i=0;i<differences.length;i++){

              if(differences[i]>0 && differences[i]<50 ){
                countLevelZero_Fivety+=1
              }
              if(differences[i]>=50 && differences[i]<100 ){
                countLeve2Fivety_Hundred+=1
              }
              if(differences[i]>=100 && differences[i]<150 ){
                countLeve3Hundred_oneFivety+=1
              }
              if(differences[i]>=150 && differences[i]<200 ){
                countLeve4oneFivety_twohundred+=1
              }
              if(differences[i]>=200 && differences[i]<250 ){
                countLeve5twohundred_twoFifty+=1
              }
              if(differences[i]>=250){
                countLeve6twoFifty+=1
              }


            }

            let countLevelZero_FivetyPercentage=(countLevelZero_Fivety/response.length)*100
            let countLevel2Fivety_HundredPercentage=(countLeve2Fivety_Hundred/response.length)*100
            let countLevel3Hundred_oneFivetyPercentage=(countLeve3Hundred_oneFivety/response.length)*100
            let countLeve4oneFivety_twohundredPercentage=(countLeve4oneFivety_twohundred/response.length)*100
            let countLeve5twohundred_twoFiftyPercentage=(countLeve5twohundred_twoFifty/response.length)*100
            let countLeve6twoFiftyPercentage=(countLeve6twoFifty/response.length)*100


             
             
             //console.log(countLevelZero_Fivety,countLeve2Fivety_Hundred,countLeve3Hundred_oneFivety,countLeve4oneFivety_twohundred)
             
             //console.log(MaxDemand,Time,CountLevel1,CountLevel2,CountLevel3,CountLevel4,CountLevel5,CountLevel6,CountAboveLimit,CountBellowLimit,SumOfEnergy,CountBellowLimitPercentage,CountAboveLimitPercentage)
             console.log( ` total length of the response is ${response.length}`)
             PeakDemandDetails.push({
              "maxDemand":MaxDemand,
              "MaxDemandTime":Time,
              "totalLength":response.length,
              "CountLevecrossLimit1_4100To4200":CountLevel1,
              "CountLevecrossLimit2_4200To4300":CountLevel2,
              "CountLevecrossLimit3_4300To4400":CountLevel3,
              "CountLevecrossLimit4_4400To4500":CountLevel4,
              "CountLevecrossLimit5_4500To4600":CountLevel5,
              "CountLevecrossLimit6_4600":CountLevel6,
              "CountLevecrossLimit1_4100To4200_Percentage":CountLevecrossLimit1_4100To4200_Percentage,
              "CountAbove_4100":CountAboveLimit,
              "CountBellow_4100":CountBellowLimit,
              "CountAbovePercentage_4100": CountAboveLimitPercentage !== null && CountAboveLimitPercentage !== undefined ? parseFloat((CountAboveLimitPercentage).toFixed(2)) : 0,
              "countBellowPercentage_4100": CountBellowLimitPercentage !== null && CountBellowLimitPercentage !== undefined ? parseFloat((CountBellowLimitPercentage).toFixed(2)) : 0,
             
              "countLevelZero_Fivety":countLevelZero_Fivety,
              "countLeve2Fivety_Hundred":countLeve2Fivety_Hundred,
              "countLeve3Hundred_oneFivety":countLeve3Hundred_oneFivety,
              "countLeve4oneFivety_twohundred":countLeve4oneFivety_twohundred,
              "countLeve5twohundred_twoFifty":countLeve5twohundred_twoFifty,
              "countLeve6twoFifty":countLeve6twoFifty,
              "countLevelZero_FivetyPercentage":parseFloat((countLevelZero_FivetyPercentage).toFixed(2)),
              "countLevel2Fivety_HundredPercentage":parseFloat((countLevel2Fivety_HundredPercentage).toFixed(2)),
              "countLevel3Hundred_oneFivetyPercentage":parseFloat((countLevel3Hundred_oneFivetyPercentage).toFixed(2)),
              "countLeve4oneFivety_twohundredPercentage":parseFloat((countLeve4oneFivety_twohundredPercentage).toFixed(2)),
              "countLeve5twohundred_twoFiftyPercentage":parseFloat((countLeve5twohundred_twoFiftyPercentage).toFixed(2)),
              "countLeve6twoFiftyPercentage":parseFloat((countLeve6twoFiftyPercentage).toFixed(2)),
              "LevelWisePercentage":LevelWisePercentage,
              "CountRangeof_4100_Above_Below":CountRangeof_4100_Above_Below,
              "CountRangeof_4200_Above_Below":CountRangeof_4200_Above_Below,
              "CountRangeof_4300_Above_Below":CountRangeof_4300_Above_Below,
              "CountRangeof_4400_Above_Below":CountRangeof_4400_Above_Below,
              "CountRangeof_4500_Above_Below":CountRangeof_4500_Above_Below
            })
            console.log(LevelWisePercentage.length)
            res.send(PeakDemandDetails)

         }
     })


    
})
//------------------------------------- END of api ---------------------------------------------//

//--------------------------------Peak analysis hourly Percentage graph (4100-4600)-----------//
app.get("/PeakDemand/Analysis/HourlyPercentage/graph",async(req,res)=>{
  const resultValue=[]

  chakradb.query("SELECT HOUR(polledTime) AS hour_of_day, SUM(CASE WHEN totalApparentPower2 BETWEEN 4100 AND 4199 THEN 1 ELSE 0 END) AS count_4100_to_4199,SUM(CASE WHEN totalApparentPower2 BETWEEN 4200 AND 4299 THEN 1 ELSE 0 END) AS count_4200_to_4299,SUM(CASE WHEN totalApparentPower2 BETWEEN 4300 AND 4399 THEN 1 ELSE 0 END) AS count_4300_to_4399,SUM(CASE WHEN totalApparentPower2 BETWEEN 4400 AND 4499 THEN 1 ELSE 0 END) AS count_4400_to_4499,SUM(CASE WHEN totalApparentPower2 BETWEEN 4500 AND 4599 THEN 1 ELSE 0 END) AS count_4500_to_4599,SUM(CASE WHEN totalApparentPower2 >= 4600 THEN 1 ELSE 0 END) AS count_greater_than_4600 FROM bmsmgmt_olap_prod_v13.hvacSchneider7230Polling WHERE DATE(polledTime) = curdate() GROUP BY hour_of_day",function(err,result,feilds){
   // DATE_SUB(CURDATE(), INTERVAL 1 DAY)  
    if(err){
          console.log(err)
      }
      else{
          const response=(JSON.parse(JSON.stringify(result)))
          for(let i=0;i<response.length;i++){
             resultValue.push({
              "Hours":response[i].hour_of_day,
              "count_4100_to_4199":parseInt(response[i].count_4100_to_4199),
              "count_4200_to_4299":parseInt(response[i].count_4200_to_4299),
              "count_4300_to_4399":parseInt(response[i].count_4300_to_4399),
              "count_4400_to_4499":parseInt(response[i].count_4400_to_4499),
              "count_4500_to_4599":parseInt(response[i].count_4500_to_4599),
              "count_greater_than_4600":parseInt(response[i].count_greater_than_4600)
            })

          
          }
          res.send(resultValue)
          console.log(resultValue.length)
      }
  })
  
})

//----------------------------------------------END of api------------------------------------//


//-----------------------------Peak analysis Hourly Percentage graph (4100 - 4600)-------------//
app.post("/PeakDemand/Analysis/HourlyPercentage/graph/DateFiltered",async(req,res)=>{
  const {date}=req.body
  const resultValue=[]

  chakradb.query(`SELECT HOUR(polledTime) AS hour_of_day, SUM(CASE WHEN totalApparentPower2 BETWEEN 4100 AND 4199 THEN 1 ELSE 0 END) AS count_4100_to_4199,SUM(CASE WHEN totalApparentPower2 BETWEEN 4200 AND 4299 THEN 1 ELSE 0 END) AS count_4200_to_4299,SUM(CASE WHEN totalApparentPower2 BETWEEN 4300 AND 4399 THEN 1 ELSE 0 END) AS count_4300_to_4399,SUM(CASE WHEN totalApparentPower2 BETWEEN 4400 AND 4499 THEN 1 ELSE 0 END) AS count_4400_to_4499,SUM(CASE WHEN totalApparentPower2 BETWEEN 4500 AND 4599 THEN 1 ELSE 0 END) AS count_4500_to_4599,SUM(CASE WHEN totalApparentPower2 >= 4600 THEN 1 ELSE 0 END) AS count_greater_than_4600 FROM bmsmgmt_olap_prod_v13.hvacSchneider7230Polling WHERE DATE(polledTime) = '${date}' GROUP BY hour_of_day`,function(err,result,feilds){
   // DATE_SUB(CURDATE(), INTERVAL 1 DAY)  
    if(err){
          console.log(err)
      }
      else{
          const response=(JSON.parse(JSON.stringify(result)))
          for(let i=0;i<response.length;i++){
             resultValue.push({
              "Hours":response[i].hour_of_day,
              "count_4100_to_4199":parseInt(response[i].count_4100_to_4199),
              "count_4200_to_4299":parseInt(response[i].count_4200_to_4299),
              "count_4300_to_4399":parseInt(response[i].count_4300_to_4399),
              "count_4400_to_4499":parseInt(response[i].count_4400_to_4499),
              "count_4500_to_4599":parseInt(response[i].count_4500_to_4599),
              "count_greater_than_4600":parseInt(response[i].count_greater_than_4600)
            })

          
          }
          res.send(resultValue)
          console.log(resultValue.length)
      }
  })
  
})
//------------------------------------------------  END of api-----------------------------------//



  //-----------------------------------------PeakDeamnd Hourly analysis---------------------------------//
  app.get("/PeakDemand/Analysis/Hourly",async(req,res)=>{
    const resultValue=[]
  
    con.query("select * from EMS.peakdemandHourly where date(polledTime) = curdate();",function(err,result,feilds){
     // DATE_SUB(CURDATE(), INTERVAL 1 DAY)  
      if(err){
            console.log(err)
        }
        else{
            const response=(JSON.parse(JSON.stringify(result)))
            for(let i=0;i<response.length;i++){
              let date = new Date(response[i].polledTime);
              let FormatedDtae=date.toLocaleString()
              const hours = date.getHours().toString().padStart(2, '0');
              const minutes = date.getMinutes().toString().padStart(2, '0');
              // const seconds = date.getSeconds().toString().padStart(2, '0');
              const timestamp = `${hours}:${minutes}`;
              if(response[i].peakdemand>=4100){
                resultValue.push({"PolledTime":FormatedDtae,"PeakDemand":response[i].peakdemand})
              }
              

            }
            res.send(resultValue)
            //console.log(resultValue.length)
        }
    })
    
})
  //-----------------------------------------END  of api-------------------------------------------------//


  //--------------------------------peakDemand Hourly filtered Analysis---------------------------------//
  app.post("/PeakDemand/Analysis/Hourly/DateFiltered",async(req,res)=>{
    const resultValue=[]
    const {date}=req.body
  
    con.query(`select * from EMS.peakdemandHourly where date(polledTime) = '${date}'`,function(err,result,feilds){
     // DATE_SUB(CURDATE(), INTERVAL 1 DAY)  
      if(err){
            console.log(err)
        }
        else{
            const response=(JSON.parse(JSON.stringify(result)))
            for(let i=0;i<response.length;i++){
              let date = new Date(response[i].polledTime);
              let FormatedDtae=date.toLocaleString()
              const hours = date.getHours().toString().padStart(2, '0');
              const minutes = date.getMinutes().toString().padStart(2, '0');
              // const seconds = date.getSeconds().toString().padStart(2, '0');
              const timestamp = `${hours}:${minutes}`;
              if(response[i].peakdemand>=4100){
                resultValue.push({"PolledTime":FormatedDtae,"PeakDemand":response[i].peakdemand})
              }
              

            }
            res.send(resultValue)
            console.log("PeakHourly applied")
        }
    })
    
})
  //--------------------------------------END of api-----------------------------------------------------//


  //-----------------------------Peak analysis value rage filter---------------------------------------------------//
  app.post("/PeakDemand/Analysis/energyRange/Filtered",async(req,res)=>{
    const resultValue=[]
    const {date}=req.body
    const {StartRange}=req.body
    const {EndRange}=req.body
  
    con.query(`SELECT totalApparentPower2, polledTime FROM bmsunprocessed_prodv13.hvacSchneider7230Polling  WHERE DATE(polledTime) = '${date}'  AND totalApparentPower2 BETWEEN ${StartRange} AND ${EndRange};`,function(err,result,feilds){
     // DATE_SUB(CURDATE(), INTERVAL 1 DAY)  
      if(err){
            console.log(err)
        }
        else{
            const response=(JSON.parse(JSON.stringify(result)))
            for(let i=0;i<response.length;i++){
              let date = new Date(response[i].polledTime);
              let FormatedDtae=date.toLocaleString()
              const hours = date.getHours().toString().padStart(2, '0');
              const minutes = date.getMinutes().toString().padStart(2, '0');
              // const seconds = date.getSeconds().toString().padStart(2, '0');
              const timestamp = `${hours}:${minutes}`;
              resultValue.push({"PolledTime":FormatedDtae,"PeakDemand":response[i].totalApparentPower2})
              

            }
            
            res.send(resultValue)
            console.log(`PeakRange between ${StartRange} to ${EndRange}  applied and length of the value is ${response.length} `)
        }
    })
    
})
  //------------------------------------  END of API---------------------------------------------------//

  //---------------------------------peakDemand Sum of energy api---------------------------------------//
  app.get("/PeakDemand/Analysis/SumOfEnergy",async(req,res)=>{
    const resultValue=[]
    let SumOfEnergy=0
    con.query("select * from peakDemandvs where date(polledTime) = curdate();",function(err,result,feilds){
     // DATE_SUB(CURDATE(), INTERVAL 1 DAY)  
      if(err){
            console.log(err)
        }
        else{
            const response=(JSON.parse(JSON.stringify(result)))
            for(let i=0;i<response.length;i++){
              let date = new Date(response[i].polledTime);
              let FormatedDtae=date.toLocaleString()
              const hours = date.getHours().toString().padStart(2, '0');
              const minutes = date.getMinutes().toString().padStart(2, '0');
              // const seconds = date.getSeconds().toString().padStart(2, '0');
              const timestamp = `${hours}:${minutes}`;

              if(response[i].peakDemand>=4300 && response[i].gridEnergy!==null ){
                SumOfEnergy+=response[i].gridEnergy
                //console.log(SumOfEnergy)
              }
              

            }
            let endSum=[parseFloat(SumOfEnergy.toFixed(2))]
            res.send(endSum)
            console.log(SumOfEnergy)
        }
    })
    
})


  //------------------------------------------END of api-----------------------------------------------//

  app.post("/PeakDemand/Analysis/SumOfEnergy/dateFiltered",async(req,res)=>{
    const resultValue=[]
    let SumOfEnergy=0
    const {date}=req.body
    con.query(`select * from peakDemandvs where date(polledTime) = '${date}'`,function(err,result,feilds){
     // DATE_SUB(CURDATE(), INTERVAL 1 DAY)  
      if(err){
            console.log(err)
        }
        else{
            const response=(JSON.parse(JSON.stringify(result)))
            for(let i=0;i<response.length;i++){
              let date = new Date(response[i].polledTime);
              let FormatedDtae=date.toLocaleString()
              const hours = date.getHours().toString().padStart(2, '0');
              const minutes = date.getMinutes().toString().padStart(2, '0');
              // const seconds = date.getSeconds().toString().padStart(2, '0');
              const timestamp = `${hours}:${minutes}`;

              if(response[i].peakDemand>=4300 && response[i].gridEnergy!==null ){
                SumOfEnergy+=response[i].gridEnergy
                //console.log(SumOfEnergy)
              }
              

            }
            let endSum=[parseFloat(SumOfEnergy.toFixed(2))]
            res.send(endSum)
            console.log(SumOfEnergy)
        } 
    })
    
})
  

//-------------------------------Deisel 1 to 5 graph api-----------------------------------------------//

app.get("/Deisel/analytics/graph",async(req,res)=>{
  const resultValue=[]
  meterDb.query("SELECT * FROM meterdata.diselenergyquaterly where date(timestamp)=curdate();",function(err,result,feilds){
   // DATE_SUB(CURDATE(), INTERVAL 1 DAY)  
    if(err){
          console.log(err)
      }
      else{
          const response=(JSON.parse(JSON.stringify(result)))
          for(let i=0;i<response.length;i++){
            let date = new Date(response[i].timestamp);
            let FormatedDtae=date.toLocaleString()
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            // const seconds = date.getSeconds().toString().padStart(2, '0');
            const timestamp = `${hours}:${minutes}`
            resultValue.push({"TimeStamp":timestamp,
            "DGNum_1_energy_difference":parseFloat(response[i].DGNum_1_energy_difference),
            "DGNum_2_energy_difference":parseFloat(response[i].DGNum_2_energy_difference),
            "DGNum_3_energy_difference":parseFloat(response[i].DGNum_3_energy_difference),
            "DGNum_4_energy_difference":parseFloat(response[i].DGNum_4_energy_difference),
            "DGNum_5_energy_difference":parseFloat(response[i].DGNum_5_energy_difference),
            

          })
        }
         
          res.send(resultValue)
          console.log(resultValue)
      }
  })
  
})


//-------------------------------- END of api ----------------------------------------------------------//




//-------------------------------Deisel 1 to 5 graph  date filter api-----------------------------------------------//

app.post("/Deisel/analytics/graph/DateFilter",async(req,res)=>{
  const {date}=req.body
  const resultValue=[]
  meterDb.query(`SELECT * FROM meterdata.diselenergyquaterly where date(timestamp)='${date}'`,function(err,result,feilds){
   // DATE_SUB(CURDATE(), INTERVAL 1 DAY)  
    if(err){
          console.log(err)
      }
      else{
          const response=(JSON.parse(JSON.stringify(result)))
          for(let i=0;i<response.length;i++){
            let date = new Date(response[i].timestamp);
            let FormatedDtae=date.toLocaleString()
            console.log(FormatedDtae)
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            // const seconds = date.getSeconds().toString().padStart(2, '0');
            const timestamp = `${hours}:${minutes}`
            resultValue.push({"TimeStamp":timestamp,
            "DGNum_1_energy_difference":parseFloat(response[i].DGNum_1_energy_difference),
            "DGNum_2_energy_difference":parseFloat(response[i].DGNum_2_energy_difference),
            "DGNum_3_energy_difference":parseFloat(response[i].DGNum_3_energy_difference),
            "DGNum_4_energy_difference":parseFloat(response[i].DGNum_4_energy_difference),
            "DGNum_5_energy_difference":parseFloat(response[i].DGNum_5_energy_difference),
            

          })
        }
         
          res.send(resultValue)
          console.log(resultValue)
      }
  })
  
})


//-------------------------------- END of api ----------------------------------------------------------//

//--------------------------------------------- Dashboard HOT water Storage api--------------------------//
app.get("/HOTWterStorage", (req,res)=>{
  const {date}=req.body
  console.log(date)
  const ResponseArray=[]

  EMSDB.query("SELECT * FROM EMS.HotWaterStorage where date(recordtimestamp)=curdate() order by recordtimestamp desc limit 1;",function(err,result){
    if (err){
      console.log(err)
    }
    else{

      const response=(JSON.parse(JSON.stringify(result)))
  for(let i=0;i<response.length;i++){
    let date = new Date(response[i].recordtimestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    // const seconds = date.getSeconds().toString().padStart(2, '0');
    const timestampVal = `${hours}:${minutes}`;
    //Average( Tank Top Temperature, Tank bottom temperature)
    const Stored_Water_Temperature=(response[i].tankBottomTemperature+response[i].tankTopTemperature)/2
    const Delivery_Temperature=response[i].hotWaterDeliveryTemperature
    const Hot_water_delivery_Flow_rate=response[i].hotWaterdeliveryRate
    const Energy_Delivered=(Hot_water_delivery_Flow_rate*4.2*(Stored_Water_Temperature-Delivery_Temperature))
    const Mass_of_stored_water=response[i].tankFuildVolume
    const Refrigerant_temperature=55
    const Energy_Stored=0
    ResponseArray.push({
      "Stored_Water_Temperature":Stored_Water_Temperature,
      "Delivery_Temperature":Delivery_Temperature,
      "Hot_water_delivery_Flow_rate":Hot_water_delivery_Flow_rate,
      "Energy_Delivered":Energy_Delivered,
      "Mass_of_stored_water":Mass_of_stored_water,
      "Refrigerant_temperature":Refrigerant_temperature,
      "Energy_Stored":Energy_Stored,
      "timestampVal":timestampVal
    })
   
  }
      console.log(ResponseArray)
      res.send(ResponseArray)
    }
  })

})

//---------------------------------------END of api-------------------------------------------------------//


//-----------------------------------------------building consumption Highlights of the Day-------------------//

app.get("/buildingconsumption/Highlights", (req,res)=>{
  //console.log(date)
  const ResponseArray=[]

  con.query("SELECT sum(gridEnergy)as gridEnergy,sum(rooftopEnergy) as rooftopEnergy,sum(wheeledinEnergy) as wheeledinEnergy,max(peakDemand) as peakDemand FROM EMS.buildingConsumption where date(polledTime)=curdate();",function(err,result){
    if (err){
      console.log(err)
    }
    else{ 


    const response=(JSON.parse(JSON.stringify(result)))
  for(let i=0;i<response.length;i++){
    let date = new Date(response[i].polledTime);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    // const seconds = date.getSeconds().toString().padStart(2, '0');
    const timestampVal = `${hours}:${minutes}`;
    ResponseArray.push({"gridEnergy":Math.trunc(response[i].gridEnergy),"rooftopEnergy":Math.trunc(response[i].rooftopEnergy),"wheeledinEnergy":Math.trunc(response[i].wheeledinEnergy),"peakDemand":Math.trunc(response[i].peakDemand),"Diesel":0})
  }
 
      console.log(ResponseArray)
      res.send(ResponseArray)
    }
  })

})
//-------------------------------------------------END of api--------------------------------------------------//

//------------------------------------building consumption highlights of the day------------------------------------//
app.post("/buildingconsumption/Highlights/DateFiltered", (req,res)=>{
  const {date}=req.body
  //console.log(date)
  const ResponseArray=[]

  con.query(`SELECT sum(gridEnergy)as gridEnergy,sum(rooftopEnergy) as rooftopEnergy,sum(wheeledinEnergy) as wheeledinEnergy,max(peakDemand) as peakDemand FROM EMS.buildingConsumption where date(polledTime)='${date}'`,function(err,result){
    if (err){
      console.log(err)
    }
    else{ 


    const response=(JSON.parse(JSON.stringify(result)))
  for(let i=0;i<response.length;i++){
    let date = new Date(response[i].polledTime);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    // const seconds = date.getSeconds().toString().padStart(2, '0');
    const timestampVal = `${hours}:${minutes}`;
    ResponseArray.push({"gridEnergy":Math.trunc(response[i].gridEnergy),"rooftopEnergy":Math.trunc(response[i].rooftopEnergy),"wheeledinEnergy":Math.trunc(response[i].wheeledinEnergy),"peakDemand":Math.trunc(response[i].peakDemand),"Diesel":0})
  }

      console.log(ResponseArray)
      res.send(ResponseArray)
    }
  })

})




//-------------------------------------------  end of api -----------------------------------------------------------//


//----------------------------------------------LOGS API------------------------------------------------------------------//

//---------------------------------------logs API for thermal and LTO------------------------------------------------//

app.get("/Logs/Thermal",async(req,res)=>{
  const {date}=req.body
  const resultValue=[]
  EMSDB.query("SELECT * FROM EMS.ThermalLog;",function(err,result,feilds){
   // DATE_SUB(CURDATE(), INTERVAL 1 DAY)  
    if(err){
          console.log(err)
      }
      else{
          const response=(JSON.parse(JSON.stringify(result)))
          for(let i=0;i<response.length;i++){
            let date = new Date(response[i].recordDate).toLocaleString();
           
            let DischargeOn=new Date(response[i].dischargeON).toLocaleString();
            let DischargeOff=response[i].dischargeOFF==null || 0 ? 0 : new Date(response[i].dischargeOFF).toLocaleString();
            let PeakDeamndON= response[i].peakDemandON==null|| 0 ? 0:response[i].peakDemandON
            let PeakDeamndOFF=response[i].peakDemandOFF==null||0 ? 0:response[i].peakDemandOFF
            let peakTime=response[i].peakTime==null||0?0:new Date(response[i].peakTime).toLocaleString();
            let serverTime=response[i].ServerTime==null||0?0:new Date(response[i].ServerTime).toLocaleString();


            const Server_TO_Peak = response[i].ServerTime!= null && response[i].peakTime!=null?new Date(response[i].ServerTime) - new Date(response[i].peakTime):0;
              const Server_TO_DischargeON=response[i].dischargeON!= null && response[i].ServerTime!=null?new Date(response[i].dischargeON) - new Date(response[i].ServerTime):0;

            const TimeStampSubtraction=(TimeStamp)=>{
              const hours = Math.floor(TimeStamp / (1000 * 60 * 60));
              const minutes = Math.floor((TimeStamp % (1000 * 60 * 60)) / (1000 * 60));
              const seconds = Math.floor((TimeStamp % (1000 * 60)) / 1000);
              const timeDifferenceFormatted = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
              //console.log(timeDifferenceFormatted)
              return(timeDifferenceFormatted)
            }

           console.log(TimeStampSubtraction(Server_TO_Peak), TimeStampSubtraction(Server_TO_DischargeON)) 


            let DateValue=date.split(",")[0]
            let DischargeOnTime=DischargeOn.split(",")[1]
            let DischargeOfTime=DischargeOff==0?"00:00:00":DischargeOff.split(",")[1]
            let peakTimeStamp=peakTime==0?"00:00:00":peakTime.split(",")[1]
            let serverTimeStamp=serverTime==0?"00:00:00":serverTime.split(",")[1]

            

            // const hours = date.getHours().toString().padStart(2, '0');
            // const minutes = date.getMinutes().toString().padStart(2, '0');
            // const seconds = date.getSeconds().toString().padStart(2, '0');
            // const timestamp = `${hours}:${minutes}`

            resultValue.push({"TimeStamp":DateValue,"cause":response[i].cause,"DischargeOn":DischargeOnTime,"DischargeOfTime":DischargeOfTime,"PeakDeamndONTime":PeakDeamndON,"peakTime":peakTimeStamp,"PeakDeamndOFFTime":PeakDeamndOFF,"serverTime":serverTimeStamp,"Server_TO_Peak":TimeStampSubtraction(Server_TO_Peak),"Server_TO_DischargeON":TimeStampSubtraction(Server_TO_DischargeON),"Energy":response[i].Energy,"Cost":response[i].Cost,"recordID":response[i].recordid})
            
        }
         
          res.send(resultValue)
          console.log(resultValue)
      }
  })
  
})

//-----------------------------------------------end-------------------------------------------------------------------//

//-------------------------------------------LTO logs api--logs------------------------------------------------------------//
app.get("/Logs/LTO",async(req,res)=>{
  const {date}=req.body
  const resultValue=[]
  EMSDB.query("SELECT * FROM EMS.ltoLogDchg;",function(err,result,feilds){
   // DATE_SUB(CURDATE(), INTERVAL 1 DAY)  
    if(err){
          console.log(err)
      }
      else{
          const response=(JSON.parse(JSON.stringify(result)))
          for(let i=0;i<response.length;i++){
            let date = new Date(response[i].recordDate).toLocaleString();
            console.log(response[i].recordDate,"line 3918")
     
            let DischargeOn=new Date(response[i].dischargeON).toLocaleString();
            let DischargeOff=response[i].dischargeOFF==null || 0 ? 0 : new Date(response[i].dischargeOFF).toLocaleString();
            let PeakDeamndON= response[i].peakDemandON==null|| 0 ? 0:response[i].peakDemandON
            let PeakDeamndOFF=response[i].peakDemandOFF==null||0 ? 0:response[i].peakDemandOFF
            let peakTime=response[i].peakTime==null||0?0:new Date(response[i].peakTime).toLocaleString();
            let serverTime=response[i].ServerTime==null||0?0:new Date(response[i].ServerTime).toLocaleString();

             
              const Server_TO_Peak = response[i].ServerTime!= null && response[i].peakTime!=null?new Date(response[i].ServerTime) - new Date(response[i].peakTime):0;
              const Server_TO_DischargeON=response[i].dischargeON!= null && response[i].ServerTime!=null?new Date(response[i].dischargeON) - new Date(response[i].ServerTime):0;

            const TimeStampSubtraction=(TimeStamp)=>{
              const hours = Math.floor(TimeStamp / (1000 * 60 * 60));
              const minutes = Math.floor((TimeStamp % (1000 * 60 * 60)) / (1000 * 60));
              const seconds = Math.floor((TimeStamp % (1000 * 60)) / 1000);
              const timeDifferenceFormatted = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
              //console.log(timeDifferenceFormatted)
              return(timeDifferenceFormatted)
            }

           console.log(TimeStampSubtraction(Server_TO_Peak), TimeStampSubtraction(Server_TO_DischargeON)) 
           

             
            


            let DateValue=date.split(",")[0]
            let DischargeOnTime=DischargeOn.split(",")[1]
            let DischargeOfTime=DischargeOff==0?"00:00:00":DischargeOff.split(",")[1]
            let peakTimeStamp=peakTime==0?"00:00:00":peakTime.split(",")[1]
            let serverTimeStamp=serverTime==0?"00:00:00":serverTime.split(",")[1]

            // const hours = date.getHours().toString().padStart(2, '0');
            // const minutes = date.getMinutes().toString().padStart(2, '0');
            // const seconds = date.getSeconds().toString().padStart(2, '0');
            // const timestamp = `${hours}:${minutes}`

            resultValue.push({"TimeStamp":response[i].recordDate,"cause":response[i].cause,"DischargeOn":DischargeOnTime,"DischargeOfTime":DischargeOfTime,"PeakDeamndON":PeakDeamndON,"peakTime":peakTimeStamp,"PeakDeamndOFF":PeakDeamndOFF,"serverTime":serverTimeStamp,"Server_TO_Peak":TimeStampSubtraction(Server_TO_Peak),"Server_TO_DischargeON":TimeStampSubtraction(Server_TO_DischargeON),"Energy":response[i].Energy,"Cost":response[i].Cost,"recordID":response[i].recordid})
        }
         
          res.send(resultValue)
          //console.log(resultValue)
      }
  })
  
})
//----------------------------------------------------end of api--------------------------------------------------------//

//------------------------------------------------------- END OF LOGS -----------------------------------------------------//

//----------------------------------------------expected Rooftop generation api------------------------------------------//
 

app.get("/Rooftop/ExpectedGeneration", (req,res)=>{
  //console.log(date)
  const ResponseArray=[]

  con.query("SELECT * FROM meterdata.expectedrooftop_generationhourly  where date(timestamp)=curdate();",function(err,result){
    if (err){
      console.log(err)
    }
    else{

    const response=(JSON.parse(JSON.stringify(result)))
  for(let i=0;i<response.length;i++){
    let date = new Date(response[i].timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    // const seconds = date.getSeconds().toString().padStart(2, '0');
    const timestampVal = `${hours}:${minutes}`;
    ResponseArray.push({"TimeStamp":timestampVal,"Ph1ActualEnergy":parseFloat(response[i].Ph1ActualEnergy),"Ph2ActualEnergy":parseFloat(response[i].Ph2ActualEnergy),"Irradiation":parseFloat(response[i].Irradiation),"Ph1ExpectedEnergy":parseFloat(response[i].Ph1ExpectedEnergy),"Ph2ExpectedEnergy":parseFloat(response[i].Ph2ExpectedEnergy)})
  }

      console.log(ResponseArray)
      res.send(ResponseArray)
    }
  })

})
 
//---------------------------------------------------------end of api ------------------------------------------------------//

//----------------------------expected Rooftop generation date filter api------------------------------------------------//
app.post("/Rooftop/ExpectedGeneration/datefiltered", (req,res)=>{
  //console.log(date)
  const {date}=req.body
  const ResponseArray=[]

  con.query(`SELECT * FROM meterdata.expectedrooftop_generationhourly  where date(timestamp)="${date}";`,function(err,result){
    if (err){
      console.log(err)
    }
    else{

    const response=(JSON.parse(JSON.stringify(result)))
  for(let i=0;i<response.length;i++){
    let date = new Date(response[i].timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    // const seconds = date.getSeconds().toString().padStart(2, '0');
    const timestampVal = `${hours}:${minutes}`;
    ResponseArray.push({"TimeStamp":timestampVal,"Ph1ActualEnergy":parseFloat(response[i].Ph1ActualEnergy),"Ph2ActualEnergy":parseFloat(response[i].Ph2ActualEnergy),"Irradiation":parseFloat(response[i].Irradiation),"Ph1ExpectedEnergy":parseFloat(response[i].Ph1ExpectedEnergy),"Ph2ExpectedEnergy":parseFloat(response[i].Ph2ExpectedEnergy)})
  }

      console.log(ResponseArray)
      res.send(ResponseArray)
    }
  })

})
//----------------------------------------end of api---------------------------------------------------------------------//

//-----------------------------------------------KVA vs KW graph api --------------------------------------------------------------//
app.get ("/KVA_vs_KW", (req,res)=>{
  //console.log(date)
  const {date}=req.body
  const ResponseArray=[]

  meterDb.query("SELECT DATE_FORMAT(kv_vs_kwh.timestamp, '%Y-%m-%d %H:%i:00') AS minute_interval, kv_vs_kwh.peakmax, kv_vs_kwh.mvp1, kv_vs_kwh.mvp2, kv_vs_kwh.mvp3, kv_vs_kwh.mvp4, SUM(kv_vs_kwh.peakmax + kv_vs_kwh.TOTALMVP) AS combined_values FROM kv_vs_kwh WHERE DATE(kv_vs_kwh.timestamp) = CURDATE() GROUP BY minute_interval, kv_vs_kwh.peakmax, kv_vs_kwh.mvp1, kv_vs_kwh.mvp2, kv_vs_kwh.mvp3, kv_vs_kwh.mvp4 ORDER BY minute_interval;",function(err,result){
    if (err){
      console.log(err)
    }
    else{

    const response=(JSON.parse(JSON.stringify(result)))
  for(let i=0;i<response.length;i++){
    let date = new Date(response[i].minute_interval);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    // const seconds = date.getSeconds().toString().padStart(2, '0');
    const timestampVal = `${hours}:${minutes}`;
    ResponseArray.push({"TimeStamp":timestampVal,"peakmax":parseFloat(response[i].peakmax),"TOTALMVP":Math.trunc(response[i].combined_values),"mvp1":Math.trunc(response[i].mvp1),"mvp2":Math.trunc(response[i].mvp2),"mvp3":Math.trunc(response[i].mvp3),"mvp4":Math.trunc(response[i].mvp4),"LimitLine1":parseInt(4000),"LimitLine2":parseInt(4500)})
  }

      console.log(ResponseArray)
      res.send(ResponseArray)
    }
  })

})
//---------------------------------------------------end of api ---------------------------------------------------------------------//

//-------------------------------------------------KVA VS KW date filter api ---------------------------------------------------------------//
app.post("/KVA_vs_KW/DateFiltered", (req,res)=>{
  //console.log(date)
  const {date}=req.body
  const ResponseArray=[]

  meterDb.query(`SELECT DATE_FORMAT(kv_vs_kwh.timestamp, '%Y-%m-%d %H:%i:00') AS minute_interval, kv_vs_kwh.peakmax, kv_vs_kwh.mvp1, kv_vs_kwh.mvp2, kv_vs_kwh.mvp3, kv_vs_kwh.mvp4, SUM(kv_vs_kwh.peakmax + kv_vs_kwh.TOTALMVP) AS combined_values FROM kv_vs_kwh WHERE DATE(kv_vs_kwh.timestamp) = '${date}' GROUP BY minute_interval, kv_vs_kwh.peakmax, kv_vs_kwh.mvp1, kv_vs_kwh.mvp2, kv_vs_kwh.mvp3, kv_vs_kwh.mvp4 ORDER BY minute_interval;`,function(err,result){
    if (err){
      console.log(err)
    }
    else{

    const response=(JSON.parse(JSON.stringify(result)))
  for(let i=0;i<response.length;i++){
    let date = new Date(response[i].minute_interval);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    // const seconds = date.getSeconds().toString().padStart(2, '0');
    const timestampVal = `${hours}:${minutes}`;
    ResponseArray.push({"TimeStamp":timestampVal,"peakmax":parseFloat(response[i].peakmax),"TOTALMVP":Math.trunc(response[i].combined_values),"mvp1":Math.trunc(response[i].mvp1),"mvp2":Math.trunc(response[i].mvp2),"mvp3":Math.trunc(response[i].mvp3),"mvp4":Math.trunc(response[i].mvp4)})
  }

      console.log(ResponseArray)
      res.send(ResponseArray)
    }
  })

})
//-----------------------------------------------------------end of api ---------------------------------------------------------------------//


//------------------------------------------BLOCK WISE DATA  graph api  ------------------------------------------------------------------------//
app.get("/BlockWise/data", (req,res)=>{
  //console.log(date)
  const ResponseArray=[]

  meterDb.query("SELECT * FROM meterdata.BlockwiseDaywise where date(timestamp) = curdate();",function(err,result){
    if (err){
      console.log(err)
    }
    else{

    const response=(JSON.parse(JSON.stringify(result)))
  for(let i=0;i<response.length;i++){
    let date = new Date(response[i].timestamp);
    let DATEFORMAT=date.toLocaleString().split(",")
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    // const seconds = date.getSeconds().toString().padStart(2, '0');
  const timestampVal = `${hours}:${minutes}`;
    ResponseArray.push({"TimeStamp":DATEFORMAT[0],"ABLOCK":Math.trunc(response[i].ABLOCK),"BBlock":Math.trunc(response[i].BBlock),"CBLOCK":Math.trunc(response[i].CBLOCK),"DBLOCK":Math.trunc(response[i].DBLOCK),"EBLOCK":Math.trunc(response[i].EBLOCK),"MLCP":Math.trunc(response[i].MLCP),"Utility":Math.trunc(response[i].Utility),"auditorium":Math.trunc(response[i].auditorium)})
  }

      console.log(ResponseArray)
      res.send(ResponseArray)
    }
  })

})
//-------------------------------------------------end of api --------------------------------------------------------------------------------------//


//-------------------------------------------------                               --------------------------------------------------------------------------//
app.post("/BlockWise/data/DateFiltered", (req,res)=>{
  //console.log(date)
  const {date}=req.body
  const ResponseArray=[]

  meterDb.query(`SELECT * FROM meterdata.BlockwiseDaywise where date(timestamp) = '${date}';`,function(err,result){
    if (err){
      console.log(err)
    }
    else{

    const response=(JSON.parse(JSON.stringify(result)))
  for(let i=0;i<response.length;i++){
    let date = new Date(response[i].timestamp);
    let DATEFORMAT=date.toLocaleString().split(",")
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    // const seconds = date.getSeconds().toString().padStart(2, '0');
    //const timestampVal = `${hours}:${minutes}`;
    ResponseArray.push({"TimeStamp":DATEFORMAT[0],"ABLOCK":Math.trunc(response[i].ABLOCK),"BBlock":Math.trunc(response[i].BBlock),"CBLOCK":Math.trunc(response[i].CBLOCK),"DBLOCK":Math.trunc(response[i].DBLOCK),"EBLOCK":Math.trunc(response[i].EBLOCK),"MLCP":Math.trunc(response[i].MLCP),"Utility":Math.trunc(response[i].Utility),"auditorium":Math.trunc(response[i].auditorium)})
  }

      console.log(ResponseArray)
      res.send(ResponseArray)
    }
  })

})
//---------------------------------------------------------end of api ----------------------------------------------------------------------------------------//



//----------------------------------------------------------Top Ten Clients get api ----------------------------------------------------------------------------------//
app.get("/TopTenClients/data", (req,res)=>{
  //console.log(date)
  const ResponseArray=[]

  meterDb.query("SELECT * FROM meterdata.toptenclientsdaywise where date(timestamp)=curdate()",function(err,result){
    if (err){
      console.log(err)
    }
    else{

    const response=(JSON.parse(JSON.stringify(result)))
  for(let i=0;i<response.length;i++){
    let date = new Date(response[i].timestamp);
    let DATEFORMAT=date.toLocaleString().split(",")
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    // const seconds = date.getSeconds().toString().padStart(2, '0');
    //const timestampVal = `${hours}:${minutes}`;
    ResponseArray.push({"TimeStamp":DATEFORMAT[0],"ACRI":Math.trunc(response[i].ACRI),"pfizer":Math.trunc(response[i].pfizer),"SGRI":Math.trunc(response[i].SGRI),"tatacommunications":Math.trunc(response[i].tatacommunications),"ginger":Math.trunc(response[i].ginger),"axxlent":Math.trunc(response[i].axxlent),"caterpillar":Math.trunc(response[i].caterpillar),"IFMR":Math.trunc(response[i].IFMR),"NMS":Math.trunc(response[i].NMS),"TCS":Math.trunc(response[i].TCS)})
  }

      console.log(ResponseArray)
      res.send(ResponseArray)
    }
  })

})
//-------------------------------------------------------------end of top ten clients api-------------------------------------------------------------------------------//


//----------------------------------------------------------Top Ten Clients post api ----------------------------------------------------------------------------------//
app.post("/TopTenClients/data/DateFilter", (req,res)=>{
  //console.log(date)
  const {date}=req.body
  const ResponseArray=[]

  meterDb.query(`SELECT * FROM meterdata.toptenclientsdaywise where date(timestamp)='${date}'`,function(err,result){
    if (err){
      console.log(err)
    }
    else{

    const response=(JSON.parse(JSON.stringify(result)))
  for(let i=0;i<response.length;i++){
    let date = new Date(response[i].timestamp);
    let DATEFORMAT=date.toLocaleString().split(",")
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    // const seconds = date.getSeconds().toString().padStart(2, '0');
    //const timestampVal = `${hours}:${minutes}`;
    ResponseArray.push({"TimeStamp":DATEFORMAT[0],"ACRI":Math.trunc(response[i].ACRI),"pfizer":Math.trunc(response[i].pfizer),"SGRI":Math.trunc(response[i].SGRI),"tatacommunications":Math.trunc(response[i].tatacommunications),"ginger":Math.trunc(response[i].ginger),"axxlent":Math.trunc(response[i].axxlent),"caterpillar":Math.trunc(response[i].caterpillar),"IFMR":Math.trunc(response[i].IFMR),"NMS":Math.trunc(response[i].NMS),"TCS":Math.trunc(response[i].TCS)})
  }

      console.log(ResponseArray)
      res.send(ResponseArray)
    }
  })

})

//-------------------------------------------------------------end of top ten clients api-------------------------------------------------------------------------------//

    





app.listen(5000,(err)=>{
    if(err){
        console.log(err)
    }
    else{
        console.log("running on port number 3000")
    }
})








/*----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------*/





// let valuesc = []
//         let valuesd = []
        
        
        
//         const resultarr=[]
        
//             // app.get("/thermal",async(res,req) => {
//             //     res.send(result)
//             // })
//         let datas = {}
//         // Function to get the values from the target database table (hvacChillerCoolingPolling and hvacCpmPolling)
//         // app.get("/thermal", (req,res)=>{
//             let c = 0
//             let chk = 0
//             const timarr = []
//             // var output = []
//             var output = {"0":{chillerEnergy: 0},"1":{chillerEnergy: 0},"2":{chillerEnergy: 0},"3":{chillerEnergy: 0},"4":{chillerEnergy: 0},"5":{chillerEnergy: 0},"6":{chillerEnergy: 0},"7":{chillerEnergy: 0},"8":{chillerEnergy: 0},"9":{chillerEnergy: 0},"10":{chillerEnergy: 0},"11":{chillerEnergy: 0},"12":{chillerEnergy: 0},"13":{chillerEnergy: 0},"14":{chillerEnergy: 0},"15":{chillerEnergy: 0},"16":{chillerEnergy: 0},"17":{chillerEnergy: 0},"18":{chillerEnergy: 0},"19":{chillerEnergy: 0},"20":{chillerEnergy: 0},"21":{chillerEnergy: 0},"22":{chillerEnergy: 0},"23":{chillerEnergy: 0}}

            
            
//             // respfunc = (key, energy)=>{
//             //     // console.log(key,energy)
//             //     output[key] = { chillerEnergy: energy }
//             //     timarr.push(output[key])
//             //     // res.send(output)
//             // }
//             // console.log(timarr)
//             // To get arranged data in hour format and calculates the average per hour and pushes the value into the values array 
//             const formatChargeData = (obj) => {
                
//                     // let output = {}
//                     // Loop through each timings in the input object
//                     for (const key in obj) {
//                     // Calculate the average chillerEnergy for the time
//                     const chillerEnergy = obj[key].chillerEnergy;
//                     const avgChillerEnergy = (chillerEnergy.reduce((a, b) => a + b) / chillerEnergy.length)/1000; // Converting Watts to kW
                    
//                     // respfunc(key,avgChillerEnergy)
//                     // Add the time and its average chillerEnergy to the output object
//                     output[key] = { chillerEnergy: avgChillerEnergy };
//                     // console.log(output)
//                     // res.send(output)
//                 }
//         //console.log(output)
//         }
//                 // console.log(result)0.
        
//                 // To group the data by hour and get the data in desired format. This function calls formatData() function
//                 // const cleanData = (arr) => {  
//                 //     const groupedByHour = arr.reduce((acc, obj) => {
//                 //     const hour = new Date(obj.timestamp).getUTCHours();
//                 //       if (!acc[hour]) {
//                 //       acc[hour] = [];
//                 //       }
//                 //       acc[hour].push(obj);
//                 //       return acc;
//                 //       }, {});
//                 //       formatData(groupedByHour)
//                 //     }
        
                   
//                     const cleanChargeData = (data)=>{
//                         let result = {};
//                         for (let i = 0; i < data.length; i++) {
//                         let timestamp = new Date(data[i].timestamp);
//                         let hour = timestamp.getUTCHours();
        
//                         if (!result[hour]) {
//                             result[hour] = {
//                             chillerEnergy: []
//                             };
//                         }
//                         result[hour].chillerEnergy.push(data[i].chillerEnergy);
//                         }
//                         // console.log(result)
//                         formatChargeData(result)
//                     }
        
//                     // To calculate the cumulative value of the chiller Energy and calls the function cleanData(chillerEnergy)
//                     let tempchargearr = [0]
//                     const cummulativeValueCharge = (chillerEnergy,time) => {
//                         Energy = Math.abs(tempchargearr.slice(-1)[0]-chillerEnergy)
//                         tempchargearr.push(chillerEnergy)
//                         // temparr = temparr.shift()
//                         // console.log(chillerEnergy,Energy)
//                         if (chillerEnergy != Energy){
//                             valuesc.push({"chillerEnergy":Energy,"timestamp":time})
//                         }
//                     }
        
//                     cleanChargeData(valuesc)
        
        
//             //Inner join query to get the coresponding value from two tables in  bmsmgmt_olap_prod_v13 database based on recordId
        
//             // SQL query to get chiller inlet and outlet , storage tank inlet and outlet from hvacCmpPolling table joined with (inner join) 
//             // hvacChillerCoolingPolling getting chiller energy.
        
//                     chakradb.query(`select hvacCpmPolling.recordId,
//                                     hvacCpmPolling.chillerInletValve1Status,hvacCpmPolling.chillerInletValve2Status,hvacCpmPolling.chillerInletValve3Status,hvacCpmPolling.chillerInletValve4Status,
//                                     hvacCpmPolling.chillerOutletValve1Status,hvacCpmPolling.chillerOutletValve2Status,hvacCpmPolling.chillerOutletValve3Status,hvacCpmPolling.chillerOutletValve4Status,
//                                     hvacCpmPolling.storageTankInletValve1Status,hvacCpmPolling.storageTankInletValve2Status,hvacCpmPolling.storageTankInletValve3Status,hvacCpmPolling.storageTankInletValve4Status,
//                                     hvacCpmPolling.storageTankOutletValve1Status,hvacCpmPolling.storageTankOutletValve2Status,hvacCpmPolling.storageTankOutletValve3Status,hvacCpmPolling.storageTankOutletValve4Status,
//                                     hvacChillerCoolingPolling.chiller1Energy,hvacChillerCoolingPolling.chiller2Energy,hvacChillerCoolingPolling.chiller3Energy,hvacChillerCoolingPolling.chiller4Energy, hvacCpmPolling.polledTime from bmsmgmt_olap_prod_v13.hvacCpmPolling inner join bmsmgmt_olap_prod_v13.hvacChillerCoolingPolling on hvacCpmPolling.polledTime = hvacChillerCoolingPolling.polledTime where Date (hvacCpmPolling.polledTime) = curdate() order by hvacChillerCoolingPolling.polledTime asc;`,function(err,queryres){
//                         if(err){
//                             console.log(err)
//                         }
//                         else{
//                             // parsing the query output into json
//                             data = JSON.parse(JSON.stringify(queryres))
//                             // console.log(datas)
//                             for (let i=0; i<data.length;i++) {
        
//                                 const recid = data[i].recordId
//                                 const ci1 = data[i].chillerInletValve1Status
//                                 const ci2 = data[i].chillerInletValve2Status
//                                 const ci3 = data[i].chillerInletValve3Status
//                                 const ci4 = data[i].chillerInletValve4Status
//                                 const co1 = data[i].chillerOutletValve1Status
//                                 const co2 = data[i].chillerOutletValve2Status
//                                 const co3 = data[i].chillerOutletValve3Status
//                                 const co4 = data[i].chillerOutletValve4Status
//                                 const si1 = data[i].storageTankInletValve1Status
//                                 const si2 = data[i].storageTankInletValve2Status
//                                 const si3 = data[i].storageTankInletValve3Status
//                                 const si4 = data[i].storageTankInletValve4Status
//                                 const so1 = data[i].storageTankOutletValve1Status
//                                 const so2 = data[i].storageTankOutletValve2Status
//                                 const so3 = data[i].storageTankOutletValve3Status
//                                 const so4 = data[i].storageTankOutletValve4Status
//                                 const corsptime = data[i].polledTime
//                                 const parsedTime = moment.tz(corsptime, tz).format('YYYY-MM-DDTHH:mm:ss.SSS[Z]')
//                                 const che1 = data[i].chiller1Energy
//                                 const che2 = data[i].chiller2Energy
//                                 const che3 = data[i].chiller3Energy
//                                 const che4 = data[i].chiller4Energy
                        
//                                 // console.log(recid)
                                
//                                 // Checking the charging status of the chillers based on the inlet and outlet valve
        
//                                     if ((ci1 == 0 && co1 == 0) && (si1 == 1 && so1 == 1)) {
//                                         // console.log("Chiller 1 Charging","Chiller Energy : ",che1,parsedTime)
//                                         if(che1 !=null){
//                                             cummulativeValueCharge(che1,parsedTime)
//                                         }
//                                     }
//                                     else if ((ci2 == 0 && co2 == 0) && (si2 ==1 && so2 == 1)) {
//                                         // console.log("Chiller 2 is charging","Chiller Energy : ",che2,parsedTime)
//                                         if(che2 !=null){
//                                             cummulativeValueCharge(che2,parsedTime)
//                                         }
//                                     }
//                                     else if ((ci3 == 0 && co3 == 0) && (si3 ==1 && so3 == 1)) {
//                                         // console.log("Chiller 3 is charging","Chiller Energy : ",che3,parsedTime)
//                                         if(che3 !=null){
//                                             cummulativeValueCharge(che3,parsedTime)
//                                         }
//                                     }
//                                     else if ((ci4 == 0 && co4 == 0) && (si4 ==1 && so4 == 1)) {
//                                         // console.log("Chiller 4 is charging","Chiller Energy : ",che4,parsedTime)
//                                         if(che4 !=null){
//                                             cummulativeValueCharge(che4,parsedTime)
//                                         }
//                                     }
//                                     // else{
//                                     //     console.log("Chillers not charging")
//                                     // }
//                                 }
//                         }
//                     })
        
//                     const formatDischargeData = (obj) => {
//                         //var output=[]
//                         // Loop through each timings in the input object
//                         // console.log(obj)
//                         for (const key in obj) {
//                         // Calculate the average chillerEnergy for the time
//                         const chillerEnergy = obj[key].chillerEnergy;
//                         const avgChillerEnergy = -Math.abs((chillerEnergy.reduce((a, b) => a + b))); // Converting Watts to kW
                        
//                         // console.log("energy : ",avgChillerEnergy)
//                         // respfunc(key,avgChillerEnergy,chkno)
//                         // Add the time and its average chillerEnergy to the output object
//                         output[key] = { chillerEnergy: avgChillerEnergy };
//                         // output.push({ "chillerEnergy": avgChillerEnergy,"time":key});
//                         // console.log(output)
//                         // console.log(output)
//                              }
//                      }
        
//                 const cleanDischargeData = (data)=>{
//                     let result = {};
//                     for (let i = 0; i < data.length; i++) {
//                     let timestamp = new Date(data[i].timestamp);
//                     let hour = timestamp.getUTCHours();
        
//                     if (!result[hour]) {
//                         result[hour] = {
//                         chillerEnergy: []
//                         };
//                     }
//                     result[hour].chillerEnergy.push(data[i].chillerEnergy);
//                     }
//                     // console.log("length : ",result['7'].chillerEnergy.length)
//                     formatDischargeData(result)
//                 }
        
//                 let tempdischargearr = [0]
//                 cummulativeValueDischarge = (chillerEnergy,time,chkno) => {
//                     Energy = Math.abs(tempdischargearr.slice(-1)[0]-chillerEnergy)
//                     tempdischargearr.push(chillerEnergy)
//                     // temparr = temparr.shift()
//                     // console.log(chillerEnergy,Energy)
//                     if (chillerEnergy != Energy){
//                         // console.log(valuesd.length,chkno-2)
//                         if(valuesd.length == (chkno -2)){
//                             // console.log(valuesd)
//                             cleanDischargeData(valuesd)
//                             valuesd = []
//                             // console.log(valuesd.length)
//                         }
//                         else{
//                         valuesd.push({"chillerEnergy":Energy,"timestamp":time})
//                         }
//                 }
//                     // console.log(valuesd.length,chkno-1)
//                     // console.log(valuesd)
//                     // console.log("values len : ",valuesd.length)
//                     // cleanDischargeData(valuesd)
//                 }
                
                
//                 unprocesseddata.query(`select polledTime,coolingEnergyConsumption,tsStoredWaterTemperature,tsOutletBDPvalveStatus,tsOutletADPvalveStatus,HValve from thermalStorageMQTTReadings where Date(polledTime)= curdate() and tsOutletADPvalveStatus = 1 and tsOutletBDPvalveStatus = 1 and HValve = 1 order by polledTime asc ;`,function(err,queryres){
//                     if(err){
//                         console.log(err)
//                     }
//                     else{
//                         // parsing the query output into json

//                         data = JSON.parse(JSON.stringify(queryres))
//                         chk = data.length
//                         for (const datum of data){
//                             const coolenergy = datum.coolingEnergyConsumption
//                             const polledtime = datum.polledTime
//                             const parsedTime = moment.tz(polledtime, tz).format('YYYY-MM-DDTHH:mm:ss.SSS[Z]')
                            
//                             // console.log(coolenergy/100,parsedTime)

//                             cummulativeValueDischarge(coolenergy/100,parsedTime,chk)
//                         }
//                         // res.send(output)
//                     }
//                 })
//             //console.log(output)
            
//         // })




