sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/export/library",
    'sap/ui/export/Spreadsheet',
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
], (Controller, exportLibrary, Spreadsheet, MessageToast, Filter, FilterOperator) => {
    "use strict";
    var that;
    var EdmType = exportLibrary.EdmType;
    return Controller.extend("vcpapp.vcpcreateso.controller.Home", {
        onInit() {
            that = this;

        },

        
        onAfterRendering: function () {
            that.oGModel = that.getOwnerComponent().getModel("oGModel");
        },
        // Upload Func Starts
        onUpload: function (oEvent) {
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
                    var workbook = XLSX.rtitlead(data, {
                        type: 'binary'
                    });
                    workbook.SheetNames.forEach(function (sheetName) {
                        // Here is your object for every sheet in workbook
                        excelData = XLSX.utils.sheet_to_row_object_array(workbook.Sheets[sheetName]);
                        if (excelData.length > 0) {
                            const requiredColumns = ['SalesOrderNumber', 'Itemnumber', 'Materialnumber', 'Location', 'UID',
                                'MaterialAvlDate', 'Quantity', 'SalesOrganization', 'DistributionChannel', 'Division', 'CustomerGroup'];
                            const nullValues = that.checkForNullValues(excelData, requiredColumns);
                            const uidConflicts = that.validateSalesOrderUIDMapping(excelData);
                            if (nullValues.length === 0 && uidConflicts.length === 0) {
                                const uniqueMaterialNumbers = that.getUniqueMaterialNumbers(excelData);
                                const uniqueUIDs = that.getUniqueUIDs(excelData);
                                if (uniqueMaterialNumbers.length === 1) {
                                    that.getUploadData(excelData, uniqueMaterialNumbers, uniqueUIDs);
                                }
                                else {
                                    sap.ui.core.BusyIndicator.hide();
                                    return MessageToast.show("Material numbers are more than one.")
                                }
                            }
                            else if (nullValues.length > 0) {
                                sap.ui.core.BusyIndicator.hide();
                                return MessageToast.show("Null values found in uploaded data");
                            }
                            else if (uidConflicts.length > 0) {
                                sap.ui.core.BusyIndicator.hide();
                                return MessageToast.show("Conflicting SalesOrderNumber-UID mappings:", uidConflicts);
                            }
                        }
                        else {
                            sap.ui.core.BusyIndicator.hide();
                            return MessageToast.show("No Data in uploaded file");
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
        Import: function (array) {
            var  dataItems = {}, dataArray = [];
            sap.ui.core.BusyIndicator.show();
            array = array.filter(id=> id.Quantity>0);
            for (let i = 0; i < array.length; i++) {
                dataItems = {
                    PRODUCT_ID: array[i].Materialnumber,
                    SEED_ORDER: array[i].SalesOrderNumber,
                    ORD_QTY: array[i].Quantity,
                    MAT_AVAILDATE: that.convertDateFormat(array[i].MaterialAvlDate),
                    CUSTOMER_GROUP: array[i].CustomerGroup,
                    LOCATION_ID: array[i].Location,
                    UNIQUE_ID: array[i].UID
                };
                dataArray.push(dataItems);
            }
            // this.getOwnerComponent().getModel("BModel").callFunction("/InsertIntoTempSO" , {
            //     method: "GET",
            //     urlParameters: {
            //         SODATA: JSON.stringify(dataArray),
            //     },
            //     success: function (oData) {
            //         if(oData.InsertIntoTempSO.includes("Successfully")){
            //             that.generateJob();
            //         }
            //         else{
            //             sap.ui.core.BusyIndicator.hide();
            //             MessageToast.show(oData.InsertIntoTempSO)
            //         }
            //     },
            //     error: function (error) {
            //         sap.ui.core.BusyIndicator.hide();
            //         sap.m.MessageToast.show(error.message);
            //     }
            // });
        },
        generateJob:function(){
            var newArray = [];
            var aScheduleSEDT = {};
            // Get Job Schedule Start/End Date/Time
            aScheduleSEDT = that.getScheduleSEDT();
            var dCurrDateTime = new Date().getTime();
            var actionText = "/v2/catalog/salesOrderCreation";
            var JobName = "Sales Order Generation" + dCurrDateTime;
            var oData = {
                SALESDATANEW: JSON.stringify("")
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
                    sap.m.MessageToast.show(error.message);
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
            if (dateString.includes("-")) {
                var parts = dateString.split('-');
            }
            else if (dateString.includes("/")) {
                var parts = dateString.split('/');
            }
            var day = parts[2]; // Day component
            var month = parts[1]; // Month component
            var year = parts[0]; // Year component

            // Pad single-digit month and day with leading zeros
            month = month.padStart(2, '0');
            day = day.padStart(2, '0');

            // Concatenate the components in yyyy-MM-dd format
            return `${year}-${month}-${day}`;
        },
        // DownLoad func Starts
        onDownLoad: function (oEvent) {
            var aDown = []
            var aCols, oSettings, oSheet;
            var sFileName = "Sales Order Input";
            // + new Date().getTime();

            var aCols = []
            aCols.push({
                property: "SalesOrderNumber",
                type: EdmType.String,
                label: "SalesOrderNumber"
            });
            aCols.push({
                property: "Itemnumber",
                type: EdmType.String,
                label: "Itemnumber"
            });
            aCols.push({
                property: "Materialnumber",
                type: EdmType.String,
                label: "Materialnumber"
            });
            aCols.push({
                property: "Location",
                type: EdmType.String,
                label: "Location"
            });
            aCols.push({
                property: "UID",
                type: EdmType.String,
                label: "UID"
            });
            aCols.push({
                property: "MaterialAvlDate",
                type: EdmType.String,
                label: "MaterialAvlDate"
            });
            aCols.push({
                property: "Quantity",
                type: EdmType.String,
                label: "Quantity"
            });
            aCols.push({
                property: "SalesOrganization",
                type: EdmType.String,
                label: "SalesOrganization"
            });
            aCols.push({
                property: "DistributionChannel",
                type: EdmType.String,
                label: "DistributionChannel"
            });
            aCols.push({
                property: "Division",
                type: EdmType.String,
                label: "Division"
            });
            aCols.push({
                property: "CustomerGroup",
                type: EdmType.String,
                label: "CustomerGroup"
            });

            var oSettings = {
                workbook: {
                    columns: aCols
                },
                dataSource: aDown,
                fileName: sFileName,
                worker: true
            };
            var oSheet = new Spreadsheet(oSettings);
            oSheet.build().finally(function () {
                oSheet.destroy();
            });
        },
        // DownLoad Func Ends
        // Function to check for null values
        checkForNullValues: function (data, requiredColumns) {
            return data.filter(row => {
                return requiredColumns.some(column => !(column in row) || row[column] === null || row[column] === '');
            });
        },
        validateSalesOrderUIDMapping: function (data) {
            const mapping = {};
            const conflicts = [];

            data.forEach(row => {
                const { SalesOrderNumber, UID } = row;
                if (mapping[SalesOrderNumber]) {
                    if (mapping[SalesOrderNumber] !== UID) {
                        conflicts.push({ SalesOrderNumber, existingUID: mapping[SalesOrderNumber], conflictingUID: UID });
                    }
                } else {
                    mapping[SalesOrderNumber] = UID;
                }
            });

            return conflicts;
        },
        getUniqueMaterialNumbers: function (data) {
            const uniqueMaterials = new Set(data.map(row => row.Materialnumber));
            return Array.from(uniqueMaterials);
        },
        getUniqueUIDs: function (data) {
            const uniqueUIDs = new Set(data.map(row => row.UID));
            return Array.from(uniqueUIDs);
        },
        getUploadData: function (excelData, uniqueMatNumber, UIDs) {
            this.getOwnerComponent().getModel("BModel").read("/getPartialProduct", {
                filters: [
                    new Filter("REF_PRODID", FilterOperator.EQ, uniqueMatNumber[0]),
                ],
                success: function (oData) {
                    if (oData.results.length > 0) {
                        that.getUniqueIdsNew(uniqueMatNumber[0], UIDs, excelData);
                    }
                    else {
                        sap.ui.core.BusyIndicator.hide();
                        return MessageToast.show("Material number not available");
                    }
                },
                error: function (error) {
                    sap.ui.core.BusyIndicator.hide();
                    sap.m.MessageToast.show("Service Connectivity Issue!");
                },
            });

        },
        getUniqueIdsNew: function (matnum, UIDS, excelData) {
            that.getOwnerComponent().getModel("BModel").callFunction("/getUniqueIDsNew", {
                method: "GET",
                urlParameters: {
                    PRODUCT_ID: JSON.stringify(matnum)
                },
                success: function (oData) {
                    var totalUIDS = JSON.parse(oData.getUniqueIDsNew);
                    if (totalUIDS.length > 0) {
                        var uIDS = UIDS;
                        const myDataCheckResults = that.checkMyDataInUniqueIDs(totalUIDS, uIDS);
                        if (myDataCheckResults.length === 0) {
                            that.Import(excelData);
                        }
                        else {
                            sap.ui.core.BusyIndicator.hide();
                            return MessageToast.show("Few UIDs doesn't belong to this Material Number")
                        }
                    }
                    else {
                        sap.ui.core.BusyIndicator.hide();
                        return MessageToast.show("No UIDs available for the selected Material Number");
                    }
                },
                error: function (er) {

                }
            });
        },
        checkMyDataInUniqueIDs: function (uniqueIDs, myData) {
            const uniqueIDSet = new Set(uniqueIDs.map(item => item.UNIQUE_ID));
            return myData.filter(id => !uniqueIDSet.has(JSON.parse(id)));
        }
    });
});