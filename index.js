import { GarminStick2, StrideSpeedDistanceSensor } from 'ant-plus-next';
import bleno from "@abandonware/bleno";
//import ZwackBLE from 'zwack';

const ble = true;
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

const ant = false;
if (ant) {
    const stick = new GarminStick2();
    /*const zwack = new ZwackBLE({
        name: 'Zwack',
        modelNumber: 'ZW-101',
        serialNumber: '1'
    });*/

    const running = new StrideSpeedDistanceSensor(stick);
    running.on('ssdData', data => {
        console.log(JSON.stringify(data));

        /*zwack.notifyRSC({
            speed: data.speed,
            cadence: data.cadence,
        });*/
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