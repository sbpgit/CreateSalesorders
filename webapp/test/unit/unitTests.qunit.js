/* global QUnit */
// https://api.qunitjs.com/config/autostart/
QUnit.config.autostart = false;

sap.ui.require([
	"vcpapp/vcp_createso/test/unit/AllTests"
], function (Controller) {
	"use strict";
	QUnit.start();
});