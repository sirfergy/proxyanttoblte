import { GarminStick2, StrideSpeedDistanceSensor, StrideSpeedDistanceSensorState } from 'ant-plus-next';
import bleno from "@abandonware/bleno";
import { RSCService } from "./services/rsc.js";
import { DeviceInformationService } from "./services/dis.js";

const ble = true;
const rscService = new RSCService();
if (ble) {
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

const ant_read = true;
if (ant_read) {
    const stick = new GarminStick2();

    const running = new StrideSpeedDistanceSensor(stick);
    running.on('ssdData', (data: StrideSpeedDistanceSensorState) => {
        console.log(JSON.stringify(data));

        const { CadenceInteger, CadenceFractional, SpeedInteger, SpeedFractional } = data;

        const speedMetersPerSecond = (SpeedInteger! + SpeedFractional!);
        const cadenceStepsPerMinute = (CadenceInteger! + CadenceFractional!);

        rscService.notify(speedMetersPerSecond, cadenceStepsPerMinute, 1, 1);
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