import { GarminStick2, StrideSpeedDistanceSensor, StrideSpeedDistanceSensorState } from 'ant-plus-next';
import bleno from "@abandonware/bleno";
import noble from "@abandonware/noble";
import { RSCService } from "./services/rsc.js";
import { DeviceInformationService } from "./services/dis.js";
import commandLineArgs from "command-line-args";
import mqtt, { MqttClient, connect } from "mqtt";

let speedMetersPerSecond = 0;
let cadenceStepsPerMinute = 0;

const optionDefinitions = [
    { name: 'rsc', type: Boolean },
    { name: 'ant', type: Boolean },
    { name: 'ftms', type: Boolean },
    { name: 'mqtt', type: Boolean },
];
const { rsc, ant, ftms } = commandLineArgs(optionDefinitions) as { rsc: boolean, ant: boolean, ftms: boolean, mqtt: Boolean };

let client: MqttClient;
const topic = "rsc";
const brokerUrl = `mqtt://127.0.0.1:1883`;

function connectToBroker() {
    client = connect(brokerUrl, {
        keepalive: 60,
        clientId: "publisherId",
        protocolId: 'MQTT',
        protocolVersion: 5,
        clean: true,
        reconnectPeriod: 1000,
        connectTimeout: 30 * 1000,
    });

    client.on("error", (err) => {
        console.log("Error: ", err);
        client.end();
    });

    client.on("connect", () => {
        console.log("Client connected to broker");
    });
}

function publishRscMessage() {
    if (client && client.connected) {
        const message = JSON.stringify({ speedMetersPerSecond, cadenceStepsPerMinute });
        client.publish(topic, message, (err) => {
            if (err) {
                console.log("Error publishing message: ", err);
            }
        });
    }
}

if (mqtt) {
    connectToBroker();
}

const rscService = new RSCService();
if (rsc) {
    bleno.on('stateChange', (state) => {
        console.log("State change " + state);
        if (state === 'poweredOn') {
            bleno.startAdvertising('RSC', [rscService.uuid]);
        } else {
            bleno.stopAdvertising();
        }
    });

    bleno.on('advertisingStart', (error) => {
        console.log("Advertising start " + error);
        if (!error) {
            bleno.setServices([
                rscService,
                new DeviceInformationService(),
            ]);
        }
    });
}

let stick: GarminStick2;
if (ant) {
    stick = new GarminStick2();

    const running = new StrideSpeedDistanceSensor(stick);
    running.on('ssdData', (data: StrideSpeedDistanceSensorState) => {
        console.log(JSON.stringify(data));

        const { CadenceInteger, CadenceFractional, SpeedInteger, SpeedFractional } = data;

        //const speedMetersPerSecond = Number(`${SpeedInteger}.${SpeedFractional}`);
        cadenceStepsPerMinute = Number(`${CadenceInteger}.${CadenceFractional}`);


        publishRscMessage();
        // rscService.notify(speedMetersPerSecond, cadenceStepsPerMinute, 0, 0);
    });

    stick.on('startup', () => {
        running.attach(0, 0);
    });

    const result = await stick.open();
    console.log('Stick open result:', result);
}

if (ftms) {
    const ftmsFlags = {
        moreData: 1,
        averageSpeed: 1 << 1,
        totalDistance: 1 << 2,
        inclination: 1 << 3,
        elevation: 1 << 4,
        pace: 1 << 5,
        averagePage: 1 << 6,
        expendedEnergy: 1 << 7,
        heartRate: 1 << 8,
        metabolicEquivalent: 1 << 9,
        elapsedTime: 1 << 10,
        remainingTime: 1 << 11,
        force: 1 << 12
    };

    noble.on('stateChange', (state) => {
        console.log(`State change: ${state}`);
        if (state == "poweredOn") {
            noble.startScanning(["1826"], true, (error) => {
                if (error) {
                    console.error(error);
                }
            });
        }
    });

    let discovered = false;
    noble.on('discover', async (peripheral) => {
        console.log(`Discovered: ${peripheral.advertisement.localName}`);
        if (!discovered && peripheral.advertisement.localName && peripheral.advertisement.localName.includes("HORIZON")) {
            discovered = true;

            await noble.stopScanningAsync();
            await peripheral.connectAsync();

            const { services } = await peripheral.discoverSomeServicesAndCharacteristicsAsync(["1826"], ["2acd"]);

            const ftms = services.find(s => s.uuid == "1826")!;
            const treadmill = ftms.characteristics.find(c => c.uuid.toLowerCase() == "2acd")!;

            await treadmill.subscribeAsync();

            treadmill.on('data', (data, isNotification) => {
                const flags = data.readUInt16LE();

                if ((flags & ftmsFlags.moreData) !== ftmsFlags.moreData) {
                    const speedInDekametersPerHour = data.readUInt16LE(2);
                    console.log(`Instantaneous speed: ${speedInDekametersPerHour}`);

                    speedMetersPerSecond = speedInDekametersPerHour * 10 / 3600;

                    publishRscMessage();
                    // rscService.notify(speedMetersPerSecond, cadenceStepsPerMinute, 0, 0);

                    return;
                }

                const averageSpeed = data.readUInt16LE(2);
                console.log(`Average speed: ${averageSpeed}`);

                const totalDistance = data.readUIntLE(4, 3);
                console.log(`Total distance: ${totalDistance}`);

                const inclination = data.readInt16LE(7);
                const rampAngleSetting = data.readInt16LE(9);
                console.log(`Inclination: ${inclination} - ${rampAngleSetting}`);

                const totalEnergy = data.readUInt16LE(11);
                const energyPerHour = data.readUInt16LE(13); // actually total energy
                const energyPerMinute = data.readUIntLE(15, 1);
                console.log(`Expended energy: ${totalEnergy} - ${energyPerHour} - ${energyPerMinute}`);

                const heartRate = data.readUIntLE(16, 1);
                console.log(`Heart rate: ${heartRate}`);

                const elapsedTime = data.readUInt16LE(17);
                console.log(`Elapsed time: ${elapsedTime}`);
            });
        }
    });
}

process.on('SIGINT', () => {
    console.log('Caught interrupt signal (Ctrl+C)');
    stick && stick.close();
    // Perform any cleanup or shutdown tasks here
    process.exit();
});