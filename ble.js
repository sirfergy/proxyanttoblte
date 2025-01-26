const bleno = require('bleno');

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
  if (state === 'poweredOn') {
    bleno.startAdvertising('RSC', [RSC_SERVICE_UUID]);
  } else {
    bleno.stopAdvertising();
  }
});

bleno.on('advertisingStart', (error) => {
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