import { GarminStick2, StrideSpeedDistanceSensor } from 'ant-plus-next';
import ZwackBLE from 'zwack';

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