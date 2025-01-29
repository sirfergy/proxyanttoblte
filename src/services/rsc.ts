import bleno from "@abandonware/bleno";

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

    onReadRequest(offset: number, callback: (offset: number, callback?: Buffer) => void) {
        console.log('RSCFeatureCharacteristic - onReadRequest');
        callback(this.RESULT_SUCCESS, this.value);
    }
}

type UpdateValueCallback = (data: Buffer) => void;

class RSCMeasurementCharacteristic extends bleno.Characteristic {
    private _updateValueCallback?: UpdateValueCallback | null;

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

    onSubscribe(maxValueSize: number, updateValueCallback: UpdateValueCallback) {
        console.log('RSC Measurement subscribed');
        this._updateValueCallback = updateValueCallback;
        // this.sendMeasurement();
    }

    onUnsubscribe() {
        console.log('RSC Measurement unsubscribed');
        this._updateValueCallback = null;
    }

    sendMeasurement(speedMetersPerSecond: number, cadenceStepsPerMinute: number, strideLengthInMeters: number, totalDistanceInKilometers: number) {
        console.log("Sending measurement");
        if (this._updateValueCallback) {
            // Example RSC measurement data
            const buffer = Buffer.alloc(10);

            let flags = 0;
            flags |= 0x01; // Instantaneous Stride Length Present
            flags |= 0x02; // Instantaneous Cadence Present

            buffer.writeUInt8(flags, 0);

            buffer.writeUInt16LE(speedMetersPerSecond * 100, 1); // Instantaneous Speed
            buffer.writeUInt8(cadenceStepsPerMinute, 3); // Instantaneous Cadence 
            buffer.writeUInt16LE(strideLengthInMeters * 100, 4); // Instantaneous Stride Length
            buffer.writeUInt32LE(totalDistanceInKilometers * 1000, 6); // Total Distance

            //buffer.writeUInt16LE(150, 1); // Instantaneous Speed (1.5 m/s)
            //buffer.writeUInt8(60, 3); // Instantaneous Cadence (60 steps/min)
            //buffer.writeUInt16LE(100, 4); // Instantaneous Stride Length (1.0 m)
            //buffer.writeUInt32LE(5000, 6); // Total Distance (5.0 km)

            this._updateValueCallback(buffer);
        }

        // Send measurement every second
        // setTimeout(this.sendMeasurement.bind(this), 1000);
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

    onReadRequest(offset: number, callback: (offset: number, callback?: Buffer) => void) {
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

    onWriteRequest(data: Buffer, offset: number, withoutResponse: boolean, callback: (arg0: number) => void) {
        console.log('SCControlPointCharacteristic - onWriteRequest:', data);

        // Handle the data written to the control point
        // Example: Resetting total distance (not implemented in mock data)
        // You can add your own logic here based on the control point commands
        callback(this.RESULT_SUCCESS);
    }
}

export class RSCService extends bleno.PrimaryService {
    private measurement: RSCMeasurementCharacteristic;

    constructor() {
        const measurement = new RSCMeasurementCharacteristic();
        super({
            uuid: RSC_SERVICE_UUID,
            characteristics: [
                measurement,
                new RSCFeatureCharacteristic(),
                new SensorLocationCharacteristic(),
                new SCControlPointCharacteristic()
            ]
        });
        this.measurement = measurement;
    }

    notify(speedMetersPerSecond: number, cadenceStepsPerMinute: number, strideLengthInMeters: number, totalDistanceInKilometers: number) {
        console.log("Notified!");
        this.measurement.sendMeasurement(speedMetersPerSecond, cadenceStepsPerMinute, strideLengthInMeters, totalDistanceInKilometers);
    }
}