/*
    Telemetrics Service

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

const package = require("../package.json");
const express = require("express");

var app = express();

app.get("/api/telemetrics", function(request, response) {
    response.send({
        status: "ok",
        version: package.version
    });
});

app.use(function(request, response, next) {
    response.status(404);

    response.send({
        status: "error",
        code: "invalidEndpoint",
        message: "The endpoint requested is invalid."
    });
});

app.listen(process.argv[2], function() {
    console.log(`LiveG Telemetrics started on port ${process.argv[2]}`);
});