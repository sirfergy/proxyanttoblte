import { Channel, GarminStick2, StrideSpeedDistanceSensor } from 'ant-plus-next';
import bleno from "@abandonware/bleno";

const ble = false;
if (ble) {
    // Define UUIDs for the RSC service and characteristics
    const RSC_SERVICE_UUID = '1814';
    const RSC_MEASUREMENT_CHARACTERISTIC_UUID = '2A53';

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
                buffer[0] = 0x03; // Flags: Instantaneous Stride Length Present, Total Distance Present
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
                        new RSCMeasurementCharacteristic(),
                    ],
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

const ant_rsc = true;
if (ant_rsc) {
    const DEVICE_TYPE = 124; // SSD Sensor

    const stick = new GarminStick2();

    if (!stick.open()) {
        console.error('ANT+ stick not found!');
        process.exit();
    }

    const channel = new Channel(stick);

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

        channel.sendBroadcastData(data);
    }

    stick.on('startup', function () {
        console.log('ANT+ stick is ready.');

        channel.setChannelType('transmit');
        channel.setDeviceType(DEVICE_TYPE);
        channel.setTransmitPower(4);
        channel.setChannelPeriod(8192);
        channel.setRfFrequency(57);
        channel.setSearchTimeout(0);

        channel.open();

        channel.on('broadcast', function (data) {
            console.log('Broadcasting:', data);
        });

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