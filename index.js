import { Messages, GarminStick2, StrideSpeedDistanceSensor } from 'ant-plus-next';
import bleno from "@abandonware/bleno";

const ble = true;
if (ble) {
    // Device Information Service Characteristics
    const manufacturerName = new bleno.Characteristic({
        uuid: MANUFACTURER_NAME_CHAR_UUID,
        properties: ['read'],
        value: Buffer.from('MyManufacturer')
    });

    const modelNumber = new bleno.Characteristic({
        uuid: MODEL_NUMBER_CHAR_UUID,
        properties: ['read'],
        value: Buffer.from('Model123')
    });

    const serialNumber = new bleno.Characteristic({
        uuid: SERIAL_NUMBER_CHAR_UUID,
        properties: ['read'],
        value: Buffer.from('SN123456')
    });

    const hardwareRevision = new bleno.Characteristic({
        uuid: HARDWARE_REVISION_CHAR_UUID,
        properties: ['read'],
        value: Buffer.from('Rev1')
    });

    const firmwareRevision = new bleno.Characteristic({
        uuid: FIRMWARE_REVISION_CHAR_UUID,
        properties: ['read'],
        value: Buffer.from('FW1.0')
    });

    const softwareRevision = new bleno.Characteristic({
        uuid: SOFTWARE_REVISION_CHAR_UUID,
        properties: ['read'],
        value: Buffer.from('SW1.0')
    });

    // Define UUIDs for the RSC service and characteristics
    const RSC_SERVICE_UUID = '1814';
    const RSC_FEATURE_CHARACTERISTIC_UUID = '2A54';
    const RSC_MEASUREMENT_CHARACTERISTIC_UUID = '2A53';
    const SENSOR_LOCATION_CHARACTERISTIC_UUID = '2A5D';
    const SC_CONTROL_POINT_CHARACTERISTIC_UUID = '2902';

    // RSC Feature Characteristic
    class RSCFeatureCharacteristic extends bleno.Characteristic {
        constructor() {
            super({
                uuid: RSC_FEATURE_CHARACTERISTIC_UUID,
                properties: ['read'],
                value: null
            });
            this.value = Buffer.from([0x07, 0x00]); // Mock: supports instantaneous stride length, total distance, and walking or running status
        }

        onReadRequest(offset, callback) {
            console.log('RSCFeatureCharacteristic - onReadRequest');
            callback(this.RESULT_SUCCESS, this.value);
        }
    }

    class RSCMeasurementCharacteristic extends bleno.Characteristic {
        constructor() {
            super({
                uuid: RSC_MEASUREMENT_CHARACTERISTIC_UUID,
                properties: ['notify'],
                value: null,
                descriptors: [
                    new bleno.Descriptor({
                        uuid: '2901',
                        value: 'Running Speed And Cadence'
                    }),
                ]
            });
        }

        onSubscribe(maxValueSize, updateValueCallback) {
            console.log('RSC Measurement subscribed');
            this._updateValueCallback = updateValueCallback;
            this.sendMeasurement();
        }

        onUnsubscribe() {
            console.log('RSC Measurement unsubscribed');
            this._updateValueCallback = null;
        }

        sendMeasurement() {
            console.log("Sending measurement");
            if (this._updateValueCallback) {
                // Example RSC measurement data
                const buffer = Buffer.alloc(10);

                flags |= 0x01; // Instantaneous Stride Length Present
                flags |= 0x02; // Instantaneous Cadence Present

                buffer.writeUInt8(flags, 0);
                buffer.writeUInt16LE(150, 1); // Instantaneous Speed (1.5 m/s)
                buffer.writeUInt8(60, 3); // Instantaneous Cadence (60 steps/min)
                buffer.writeUInt16LE(100, 4); // Instantaneous Stride Length (1.0 m)
                buffer.writeUInt32LE(5000, 6); // Total Distance (5.0 km)

                this._updateValueCallback(buffer);
            }

            // Send measurement every second
            setTimeout(this.sendMeasurement.bind(this), 1000);
        }
    }

    class SensorLocationCharacteristic extends bleno.Characteristic {
        constructor() {
            const sensorLocation = 13; // Example: 13 for top of the shoe
            super({
                uuid: SENSOR_LOCATION_CHARACTERISTIC_UUID,
                properties: ['read'],
                value: null
            });
            this.value = Buffer.from([sensorLocation]);
        }

        onReadRequest(offset, callback) {
            console.log('SensorLocationCharacteristic - onReadRequest');
            callback(this.RESULT_SUCCESS, this.value);
        }
    }

    class SCControlPointCharacteristic extends bleno.Characteristic {
        constructor() {
            super({
                uuid: SC_CONTROL_POINT_CHARACTERISTIC_UUID,
                properties: ['write', 'indicate'],
                value: null
            });
        }

        onWriteRequest(data, offset, withoutResponse, callback) {
            console.log('SCControlPointCharacteristic - onWriteRequest:', data);

            // Handle the data written to the control point
            // Example: Resetting total distance (not implemented in mock data)
            // You can add your own logic here based on the control point commands
            callback(this.RESULT_SUCCESS);
        }
    }

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
                new bleno.PrimaryService({
                    uuid: RSC_SERVICE_UUID,
                    characteristics: [
                        new RSCFeatureCharacteristic(),
                        new RSCMeasurementCharacteristic(),
                        new SensorLocationCharacteristic(),
                        new SCControlPointCharacteristic(),
                    ],
                }),
                new bleno.PrimaryService({
                    uuid: DIS_SERVICE_UUID,
                    characteristics: [
                        manufacturerName,
                        modelNumber,
                        serialNumber,
                        hardwareRevision,
                        firmwareRevision,
                        softwareRevision
                    ]
                }),
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