import { Messages, GarminStick2, StrideSpeedDistanceSensor } from 'ant-plus-next';
import bleno from "@abandonware/bleno";
import { RSCService, RSC_SERVICE_UUID } from "./services/rsc.js";
import DeviceInformationService from "./services/dis.js";

const ble = true;
if (ble) {
    bleno.on('stateChange', (state) => {
        console.log("State change " + state);
        if (state === 'poweredOn') {
            bleno.startAdvertising('RSC', [RSC_SERVICE_UUID]);
        } else {
            bleno.stopAdvertising();
        }
    });

    bleno.on('advertisingStart', (error) => {
        console.log("Advertising start " + error);
        if (!error) {
            bleno.setServices([
                new RSCService(),
                new DeviceInformationService(),
            ]);
        }
    });
}

const ant_read = false;
if (ant_read) {
    const stick = new GarminStick2();

    const running = new StrideSpeedDistanceSensor(stick);
    running.on('ssdData', data => {
        console.log(JSON.stringify(data));
    });

    stick.on('startup', () => {
        running.attachSensor(0, 0);
    });

    const result = await stick.open();
    console.log('Stick open result:', result);

    process.on('SIGINT', () => {
        console.log('Caught interrupt signal (Ctrl+C)');
        stick.close();
        // Perform any cleanup or shutdown tasks here
        process.exit();
    });
}

const ant_rsc = false;
if (ant_rsc) {
    const DEVICE_TYPE = 124; // SSD Sensor

    const stick = new GarminStick2();

    if (!stick.open()) {
        console.error('ANT+ stick not found!');
        process.exit();
    }

    function getStrideData() {
        const speed = 3.5; // meters per second
        const distance = 1000; // meters
        const strides = 150; // number of strides
        return { speed, distance, strides };
    }

    function broadcastStrideData() {
        const { speed, distance, strides } = getStrideData();

        const speedData = Math.round(speed * 256); // speed in 1/256th m/s
        const distanceData = Math.round(distance * 16); // distance in 1/16th m
        const stridesData = strides; // number of strides

        const data = [
            speedData & 0xFF, (speedData >> 8) & 0xFF,
            distanceData & 0xFF, (distanceData >> 8) & 0xFF,
            stridesData & 0xFF, (stridesData >> 8) & 0xFF,
            0, 0 // Reserved bytes
        ];

        //const data = Buffer.alloc(8);
        //data.writeUInt16LE(speedData, 0);
        //data.writeUInt16LE(distanceData, 2);
        //data.writeUInt16LE(stridesData, 4);

        // const message = Buffer.concat([Buffer.from([0xA4, 0x09, 0x4E, 0x00]), data, Buffer.from([0xEF])]);

        const message = Messages.buildMessage(data);

        Messages.broadcastData(0, message);
    }

    stick.on('startup', function () {
        console.log('ANT+ stick is ready.');

        // Broadcast stride data every second
        setInterval(broadcastStrideData, 1000);
    });

    stick.on('error', function (err) {
        console.error('Error:', err);
    });

    process.on('SIGINT', () => {
        console.log('Caught interrupt signal (Ctrl+C)');
        stick.close();
        // Perform any cleanup or shutdown tasks here
        process.exit();
    });
}