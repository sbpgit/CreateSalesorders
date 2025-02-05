sap.ui.define([
    "sap/ui/core/mvc/Controller"
], (Controller) => {
    "use strict";
    var that;
    return Controller.extend("vcpapp.vcpcreateso.controller.Home", {
        onInit() {
            that=this;
            
        },
        onAfterRendering:function(){
            that.oGModel = that.getOwnerComponent().getModel("oGModel");
        },
        // Upload Func Starts
        onUpload:function(oEvent){
            sap.ui.core.BusyIndicator.show();
            this.importExcel(oEvent.getParameter("files") && oEvent.getParameter("files")[0]);
        },
        importExcel: function (file) {
            if (file.type.endsWith("spreadsheetml.sheet") == false) {
                return MessageToast.show("Please upload only files of type XLSX");
            }
            sap.ui.core.BusyIndicator.show();
            that.oExcel = {
                SALESDATA: [],
            };
            var excelData = [];
            if (file && window.FileReader) {
                var reader = new FileReader();
                reader.onload = function (e) {
                    var data = e.target.result;
                    var workbook = XLSX.read(data, {
                        type: 'binary'
                    });
                    workbook.SheetNames.forEach(function (sheetName) {
                        // Here is your object for every sheet in workbook
                        excelData = XLSX.utils.sheet_to_row_object_array(workbook.Sheets[sheetName]);
                        if (excelData.length > 0) {
                            that.Import(excelData);
                        }
                        else {
                            sap.ui.core.BusyIndicator.hide();
                            return MessageToast.show("Wrong file uploaded")
                        }
                    });
                }
                reader.onerror = function (ex) {
                    sap.ui.core.BusyIndicator.hide();
                    console.log(ex);

                };
                reader.readAsBinaryString(file);

            }
        },
        Import:function(array){
            var newArray = [], dataItems = {}, dataArray = [];
            var aScheduleSEDT = {};
            // Get Job Schedule Start/End Date/Time
            aScheduleSEDT = that.getScheduleSEDT();
            var dCurrDateTime = new Date().getTime();
            var actionText = "/v2/catalog/salesOrderCreation";
            var JobName = "Sales Order Generation" + dCurrDateTime;
            sap.ui.core.BusyIndicator.show();
            for(let i = 0; i < array.length; i++){
                dataItems = {
                PRODUCT_ID:array[i].Materialnumber,
                SEED_ORDER: array[i].SalesOrderNumber,
                CONFIRMED_QTY: array[i].Quantity,
                MAT_AVAILDATE:that.convertDateFormat(array[i].MaterialAvlDate),
                CUSTOMER_GROUP: array[i].CustomerGroup,
                LOCATION_ID: array[i].Location,
                UNIQUE_ID:array[i].UID
            };
            dataArray.push(dataItems);            
        }
        var oData = {
            SALESDATANEW: JSON.stringify(dataArray)
        }
            var Obj = {
                data: oData,
                cron: "",
                time: aScheduleSEDT.oneTime,
                active: true,
                startTime: that.addMinutesToDateTime(aScheduleSEDT.dsSDate, 0),
                endTime: that.addMinutesToDateTime(aScheduleSEDT.dsEDate, 2)
            };
            newArray.push(Obj);
            var finalList = {
                name: JobName,
                description: "Sales Order Generation",
                action: encodeURIComponent(actionText),
                active: true,
                httpMethod: "POST",
                startTime: aScheduleSEDT.djSdate,
                endTime: aScheduleSEDT.djEdate,
                createdAt: aScheduleSEDT.djSdate,
                schedules: newArray
            };
            this.getOwnerComponent().getModel("JModel").callFunction("/addMLJob", {
                method: "GET",
                urlParameters: {
                    jobDetails: JSON.stringify(finalList),
                },
                success: function (oData) {
                    sap.ui.core.BusyIndicator.hide();
                    sap.m.MessageToast.show(oData.addMLJob + ": Job Created");
                },
                error: function (error) {
                    sap.ui.core.BusyIndicator.hide();
                    sap.m.MessageToast.show("Service Connectivity Issue!");
                },
            });
        },
        getScheduleSEDT: function () {
            var aScheduleSEDT = {};
            var dDate = new Date();
            // 07-09-2022-1                
            var idSchTime = dDate.setSeconds(dDate.getSeconds() + 20);
            // 07-09-2022-1
            var idSETime = dDate.setHours(dDate.getHours() + 2);
            idSchTime = new Date(idSchTime);
            idSETime = new Date(idSETime);
            //var onetime = idSchTime;
            var djSdate = new Date(),
                djEdate = idSETime,
                dsSDate = new Date(),
                dsEDate = idSETime,
                tjStime,
                tjEtime,
                tsStime,
                tsEtime;

            djSdate = djSdate.toISOString().split("T");
            tjStime = djSdate[1].split(":");
            djEdate = djEdate.toISOString().split("T");
            tjEtime = djEdate[1].split(":");
            dsSDate = dsSDate.toISOString().split("T");
            tsStime = dsSDate[1].split(":");
            dsEDate = dsEDate.toISOString().split("T");
            tsEtime = dsEDate[1].split(":");

            var dDate = new Date().toLocaleString().split(" ");
            aScheduleSEDT.djSdate = djSdate[0] + " " + tjStime[0] + ":" + tjStime[1] + " " + "+0000";
            aScheduleSEDT.djEdate = djEdate[0] + " " + tjEtime[0] + ":" + tjEtime[1] + " " + "+0000";
            aScheduleSEDT.dsSDate = dsSDate[0] + " " + tsStime[0] + ":" + tsStime[1] + " " + "+0000";
            aScheduleSEDT.dsEDate = dsEDate[0] + " " + tsEtime[0] + ":" + tsEtime[1] + " " + "+0000";
            aScheduleSEDT.oneTime = idSchTime;

            return aScheduleSEDT;

        },
        addMinutesToDateTime: function (dateTimeString, minutesToAdd) {
            // Split the datetime string into its components
            const [datePart, timePart, offset] = dateTimeString.split(" ");
            // Create a combined string that JavaScript Date can parse
            const dateTime = `${datePart}T${timePart}:00${offset}`;
            // Create a Date object
            const date = new Date(dateTime);
            // Add the specified minutes
            date.setMinutes(date.getMinutes() + minutesToAdd);
            // Format the updated Date object back to the original format
            const updatedDatePart = date.toISOString().slice(0, 10);
            const updatedTimePart = date.toISOString().slice(11, 16);
            const updatedOffset = offset;

            return `${updatedDatePart} ${updatedTimePart} ${updatedOffset}`;
        },
        convertDateFormat: function (dateString) {
            // Split the original date string into day, month, and year components
            var parts = dateString.split('/');
            var day = parts[2]; // Day component
            var month = parts[1]; // Month component
            var year = parts[0]; // Year component

            // Pad single-digit month and day with leading zeros
            month = month.padStart(2, '0');
            day = day.padStart(2, '0');

            // Concatenate the components in yyyy-MM-dd format
            return `${year}-${month}-${day}`;
        }
    });
});