import bleno from "@abandonware/bleno";

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

            let flags = 0;
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

class RSCService extends bleno.PrimaryService {
    constructor() {
        super({
            uuid: RSC_SERVICE_UUID,
            characteristics: [
                new RSCMeasurementCharacteristic(),
                new RSCFeatureCharacteristic(),
                new SensorLocationCharacteristic(),
                new SCControlPointCharacteristic()
            ]
        });
    }
}

export {
    RSCService, RSC_SERVICE_UUID
};

//export default RSCService;