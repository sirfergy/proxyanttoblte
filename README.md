# proxyanttoblte
Proxy ANT+ sensors to BTLE equivalents

Setting up for Raspberry Pi
https://gallochri.com/2020/05/universal-treadmill-speed-sensor-for-zwift-with-ant-stick-and-raspberry-pi/

lsusb
sudo vim /etc/udev/rules.d/Dynastream-ANTUSB-m.rules
SUBSYSTEM=="usb", ATTRS{idVendor}=="0fcf", ATTRS{idProduct}=="1009", RUN+="/sbin/modprobe usbserial vendor=0x0fcf product=0x1009", MODE="0666", OWNER="pi", GROUP="root"

Running Pod
Sample JSON:
{
    "DeviceId": 39839,
    "CadenceInteger": 46,
    "CadenceFractional": 8,
    "SpeedInteger": 1,
    "SpeedFractional": 217,
    "Status": 1,
    "TimeFractional": 82,
    "TimeInteger": 135,
    "DistanceInteger": 255,
    "DistanceFractional": 10,
    "StrideCount": 22,
    "UpdateLatency": 45
}
