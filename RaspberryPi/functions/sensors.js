const server = require('./server');// data module
const KETTLE_WEIGHT = 440;

let currentWater = -1000,
    currentTemperature = 0,
    totalWaterReserved = 0;

let lastWeightMeasurements = [];
let waterIsCounted = false;

let brewingStatus = 'Not Brewing';
let kettleStatus = 'Off';

function startListeners() {
    server.listenRef("/kettle/status", toggleStatus);
    server.listenRef("kettle/brewing", toggleBrewing);
    server.listenRef("/reservations/", countWaterReserved);
    server.listenRefChild("/reservations/", processNewReservations);
}

function toggleStatus(statusRef) {
    let status = statusRef.val()

    if (status.toLowerCase() === "starting") {
        if (waterIsCounted) {
            server.sendToFirebase("/kettle/status", "Idle").then(function () {
                console.log("Status changed to:" + status);
            });
        }
        //TODO add code to turn the kettle ON if proper hardware exists!
    } else if (status.toLowerCase() === "shutting down") {
        server.sendToFirebase("/kettle/status", "Off").then(function () {
            console.log("Status changed to:" + status);
        });
        //TODO add code to turn the kettle OFF if proper hardware exists!
    }

    kettleStatus = status;
}

function toggleBrewing(brewingRef) {
    brewingStatus = brewingRef.val();

    console.log(brewingStatus);

    if (brewingStatus.toLowerCase() === "starting") {
        server.sendToFirebase("/kettle/brewing", "Brewing").then(function () {
            console.log("Brewing changed to: Brewing");
        });
    } else if (brewingStatus.toLowerCase() === "stop brewing") {
        server.sendToFirebase("/kettle/brewing", "Not Brewing").then(function () {
            console.log("Brewing changed to: Stop Brewing");
        });
    } else if (brewingStatus.toLowerCase() === "brewing") {
        server.getUserReservationByStatus("Approved", processApprovedReservations);
    } else if (brewingStatus.toLowerCase() === "not brewing") {
        // truncateUserReservations();
    }
}

function truncateUserReservations() {
    let emptyObject = {};
    server.sendToFirebase("/user-reservations/", emptyObject).then(
        () => {
            console.log("User Reservations Truncated")
        }
    );
}

function countWaterReserved(reservationsRef) {
    let WaterReserved = 0;
    let reservations = reservationsRef.val();

    if (reservations !== null) {
        let entries = Object.values(reservations);
        entries.forEach(function (entry) {
            if (entry.status.toLowerCase() === "approved") {
                WaterReserved += parseInt(entry.amount);
            }
        });
    }
    totalWaterReserved = WaterReserved;
    waterIsCounted = true;
}

function processNewReservations(reservationRef) {

    if (waterIsCounted) {
        let reservation = reservationRef.val();

        let UUID = reservationRef.getRef().getKey();

        if (reservation.status.toLowerCase() === "pending" && kettleStatus.toLowerCase() === "idle") {
            if (reservation.amount < currentWater - totalWaterReserved && reservation.amount > 27) {
                let nextStatus = brewingStatus.toLowerCase() === "brewing" ? "Brewing" : "Approved";
                server.sendToFirebase("/reservations/" + UUID + "/status", nextStatus)
                    .then(
                        function () {
                            console.log("/reservations/" + UUID + "changed to " + nextStatus);
                        }
                    );
                server.sendToFirebase("/user-reservations/" + reservation.userUid + "/" + UUID + "/status", nextStatus)
                    .then(
                        function () {
                            console.log("/user-reservations/" + reservation.userUid + "/" + UUID + "changed to " + nextStatus);
                        }
                    );
            } else {
                server.sendToFirebase("/reservations/" + UUID + "/status", "Rejected")
                    .then(
                        function () {
                            console.log("/reservations/" + UUID + "changed to Rejected");
                        }
                    );
                server.sendToFirebase("/user-reservations/" + reservation.userUid + "/" + UUID + "/status", "Rejected")
                    .then(
                        function () {
                            console.log("/user-reservations/" + reservation.userUid + "/" + UUID + "changed to Rejected");
                        }
                    );
            }
        }
    }
}

function processApprovedReservations(reservationsRef) {

    let reservations = reservationsRef.val();

    if (reservations !== null) {
        for (const [UUID, entry] of Object.entries(reservations)) {
            if (entry.status.toLowerCase() === "approved") {
                server.sendToFirebase("/reservations/" + UUID + "/status", "Brewing")
                    .then(
                        function () {
                            console.log("/reservations/" + UUID + "changed to Brewing");
                        }
                    );
                server.sendToFirebase("/user-reservations/" + entry.userUid + "/" + UUID + "/status", "Brewing")
                    .then(
                        function () {
                            console.log("/user-reservations/" + entry.userUid + "/" + UUID + "changed to Brewing");
                        }
                    );
            }
        }
    }
}

function processBrewingReservations(reservationsRef) {

    let reservations = reservationsRef.val();

    if (reservations !== null) {
        for (const [UUID, entry] of Object.entries(reservations)) {
            server.sendToFirebase("/reservations/" + UUID + "/status", "Done")
                .then(
                    function () {
                        console.log("/reservations/" + UUID + " changed to Done");
                        server.sendToFirebase("/user-reservations/" + entry.userUid + "/" + UUID + "/status", "Done")
                            .then(
                                function () {
                                    console.log("/user-reservations/" + entry.userUid + "/" + UUID + " changed to Done");
                                    server.sendToFirebase("/reservations/" + UUID + "/status", "Deleted")
                                        .then(
                                            function () {
                                                console.log("/reservations/" + UUID + " changed to Deleted");
                                                server.sendToFirebase("/user-reservations/" + entry.userUid + "/" + UUID + "/status", "Deleted")
                                                    .then(
                                                        function () {
                                                            console.log("/user-reservations/" + entry.userUid + "/" + UUID + " changed to Deleted");
                                                            deleteReservation(entry, UUID);
                                                        }
                                                    );
                                            }
                                        );
                                }
                            );
                    }
                );
        }
    }
}

function deleteReservation(entry, UUID) {
    server.deleteFromFirebase("/user-reservations/" + entry.userUid + "/" + UUID)
        .then(
            function () {
                console.log("/user-reservations/" + entry.userUid + "/" + UUID + " Deleted");
                server.deleteFromFirebase("/reservations/" + UUID)
                    .then(
                        function () {
                            console.log("/reservations/" + UUID + " Deleted");
                        }
                    );
            }
        )
}

function processDoneReservation(reservationsRef) {

    let reservations = reservationsRef.val();

    if (reservations !== null) {
        for (const [UUID, entry] of Object.entries(reservations)) {
            server.sendToFirebase("/reservations/" + UUID + "/status", "Deleted")
                .then(
                    function () {
                        console.log("/reservations/" + UUID);
                        server.sendToFirebase("/user-reservations/" + entry.userUid + "/" + UUID + "/status", "Deleted")
                            .then(
                                function () {
                                    console.log("/user-reservations/" + entry.userUid + "/" + UUID);
                                    deleteReservation(entry, UUID)
                                }
                            );
                    }
                );
        }
    }
}

function handleArduinoData(data) {
    currentTemperature = parseFloat(data["temp"]);
    addWaterMeasurement(parseInt(data["water"]) - KETTLE_WEIGHT);
    checkBrewing();
}

function addWaterMeasurement(measurement) {
    lastWeightMeasurements.push(Math.max((measurement / 10), 0));
    if (lastWeightMeasurements.length >= 10) {
        lastWeightMeasurements = lastWeightMeasurements.slice(-10);

        updateWaterLevel(
            lastWeightMeasurements.reduce(
                (a, b) => a + b
            )
        );
    }
}

function updateWaterLevel(newWaterLevel) {
    console.log("water: " + newWaterLevel);
    if (currentWater * 0.95 > newWaterLevel || newWaterLevel > currentWater * 1.05) {
        currentWater = Math.round(newWaterLevel);
        server.sendToFirebase('kettle/cur_water', currentWater)
            .then(
                function () {
                    if (parseInt(currentWater) === 0) {
                        console.log("Kettle set to empty");
                    } else {
                        console.log("Water Level changed to " + currentWater + " ml");
                    }
                }
            );
        if (!waterIsCounted) {
            waterIsCounted = true;
            server.sendToFirebase("/kettle/status", "Idle").then(function () {
                console.log("Status changed to:" + status);
            });
        }
    }
}

function checkBrewing() {
    if (currentTemperature > 100 && brewingStatus === "Brewing") {
        server.sendToFirebase('kettle/brewing', "Stop Brewing")
            .then(
                function () {
                    console.log("Kettle Stops brewing");
                }
            );
        server.getUserReservationByStatus("Brewing", processBrewingReservations);
        server.getUserReservationByStatus("Rejected", processDoneReservation);
        truncateUserReservations();
        // In order to fix this we need another status instead of not brewing, Ex. Cooling down.
    } else if (currentTemperature > 30 && currentTemperature <= 100 && brewingStatus === "Not Brewing") {
        server.sendToFirebase('kettle/brewing', "Starting")
            .then(
                function () {
                    console.log("Kettle Starts brewing");
                }
            );
        server.getUserReservationByStatus("Approved", processApprovedReservations);
    }
}

let output = {
    startListeners: startListeners,
    handleArduinoData: handleArduinoData,
};

module.exports = output;