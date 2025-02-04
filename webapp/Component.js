sap.ui.define([
    "sap/ui/core/UIComponent",
    "vcpapp/vcpcreateso/model/models"
], (UIComponent, models) => {
    "use strict";

    return UIComponent.extend("vcpapp.vcpcreateso.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // set the device model
            this.setModel(models.createDeviceModel(), "device");

            // enable routing
            this.getRouter().initialize();
            // set the device model
            this.setModel(models.createDeviceModel(), "device");
            //Plugins of Excel
            var jQueryScript = document.createElement('script');
            jQueryScript.setAttribute('src', 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.10.0/jszip.js');
            document.head.appendChild(jQueryScript);
            var jQueryScript = document.createElement('script');
            jQueryScript.setAttribute('src', 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.10.0/xlsx.js');
            document.head.appendChild(jQueryScript);
        }
    });
});