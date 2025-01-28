import { GarminStick2, StrideSpeedDistanceSensor } from 'ant-plus-next';
import bleno from "@abandonware/bleno";
import { RSCService, RSC_SERVICE_UUID } from "./services/rsc.js";
import { DeviceInformationService } from "./services/dis.js";
const ble = true;
const rscService = new RSCService();
if (ble) {
    bleno.on('stateChange', (state) => {
        console.log("State change " + state);
        if (state === 'poweredOn') {
            bleno.startAdvertising('RSC', [RSC_SERVICE_UUID]);
        }
        else {
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
    setTimeout(() => rscService.notify(), 1000);
}
const ant_read = false;
if (ant_read) {
    const stick = new GarminStick2();
    const running = new StrideSpeedDistanceSensor(stick);
    running.on('ssdData', data => {
        console.log(JSON.stringify(data));
    });
    stick.on('startup', () => {
        running.attach(0, 0);
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
