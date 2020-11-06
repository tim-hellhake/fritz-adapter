import fetch from 'node-fetch';
import { parseStringPromise } from 'xml2js';
import { createHash } from 'crypto';
import { EventEmitter } from 'events';

interface SessionInfoResponse {
    SessionInfo: SessionInfo
}

interface SessionInfo {
    SID: string[],
    Challenge: string[],
    BlockTime: string[],
    Rights: SessionRight[]
}

interface SessionRight {
    Name: string[],
    Access: string[]
}

interface ColorDefaultsResponse {
    colordefaults: {
        hsdefaults: HSDefaultResponse[],
        temperaturedefaults: TemperatureDefaultResponse[]
    }
}

interface HSDefaultResponse {
    hs: {
        '$': {
            hue_index: string
        },
        name: [
            {
                '_': string,
                '$': {
                    'enum': string
                }
            }
        ],
        color: {
            '$': {
                sat_index: string,
                hue: string,
                sat: string,
                val: string
            }
        }[]
    }[]
}

interface TemperatureDefaultResponse {
    temp: {
        '$': {
            value: string
        }
    }[]
}


interface DeviceInfosResponse {
    devicelist: {
        $: {
            version: string,
            fwversion: string
        },
        device: DeviceResponse[]
    }
}

interface DeviceResponse {
    '$': {
        identifier: string,
        id: string,
        functionbitmask: string,
        fwversion: string,
        manufacturer: string,
        productname: string
    },
    present: string[],
    txbusy: string[],
    name: string[],
    simpleonoff: [
        {
            state: string[]
        }
    ],
    temperature: [
        {
            celsius: string[],
            offset: string[]
        }
    ],
    levelcontrol: [
        {
            level: string[],
            levelpercentage: string[]
        }
    ],
    colorcontrol: [
        {
            $: {
                supported_modes: string,
                current_mode: string
            },
            hue: string[],
            saturation: string[],
            temperature: string[]
        }
    ],
    etsiunitinfo: [
        {
            etsideviceid: string[],
            unittype: string[],
            interfaces: string[]
        }
    ],
    battery: string[],
    batterylow: string[],
    hkr: [
        {
            tist: string[],
            tsoll: string[],
            absenk: string[],
            komfort: string[],
            lock: string[],
            devicelock: string[],
            errorcode: string[],
            windowopenactiv: string[],
            windowopenactiveendtime: string[],
            boostactive: string[],
            boostactiveendtime: string[],
            batterylow: string[],
            battery: string[],
            nextchange: [
                {
                    endperiod: string[],
                    tchange: string[]
                }
            ],
            summeractive: string[],
            holidayactive: string[]
        }
    ],
    switch: [
        {
            state: string[],
            mode: string[],
            lock: string[],
            devicelock: string[]
        }
    ],
    powermeter: [
        {
            voltage: string[],
            power: string[],
            energy: string[]
        }
    ]
}

interface DeviceInfo {
    identifier: string,
    productname: string,
    name: string,
    features: string[],
    simpleonoff?: {
        state: boolean
    },
    temperature?: {
        celsius: number,
        offset: number
    },

    levelcontrol?: {
        level: number,
        levelpercentage: number
    },
    colorcontrol?: {
        color?: Color,
        temperature?: number
    },
    battery?: number,
    batterylow?: boolean,
    thermostat?: {
        currentTemperature: number,
        targetTemperature: number
    },
    switch?: {
        state: boolean
    },
    powermeter?: {
        voltage: number,
        power: number,
        energy: number
    }
}

export interface Color {
    hue: number,
    sat: number
}

export interface ColorDefaults {
    colors: MainColor[],
    colorTemperatures: ColorTemperature[]
}

export interface MainColor {
    name: string,
    colors: SubColor[]
}

export interface SubColor {
    sat_index: number,
    hue: number,
    sat: number,
    val: number
}

export interface ColorTemperature {
    kelvin: number
}

export class FritzDevice extends EventEmitter {
    constructor(protected client: FritzClient, protected deviceInfo: DeviceInfo) {
        super();

        client.on('info', (deviceInfo: DeviceInfo) => {
            if (deviceInfo.identifier == this.deviceInfo.identifier) {
                if (deviceInfo?.battery ?? false) {
                    this.emit('battery', deviceInfo?.battery);
                }

                if (deviceInfo?.batterylow ?? false) {
                    this.emit('batterylow', deviceInfo?.batterylow);
                }
            }
        });
    }

    public getAin(): string {
        return this.deviceInfo.identifier;
    }

    public getName(): string {
        return this.deviceInfo.name;
    }

    public toString(): string {
        return `${this.deviceInfo.name} [${this.deviceInfo.identifier}] (${this.deviceInfo.productname})`;
    }

    public hasBattery(): boolean {
        return typeof this.deviceInfo?.battery === "number";
    }
}

export class FritzTemperatureSensor extends FritzDevice {
    constructor(client: FritzClient, deviceInfo: DeviceInfo) {
        super(client, deviceInfo);

        client.on('info', (deviceInfo: DeviceInfo) => {
            if (deviceInfo.identifier == this.deviceInfo.identifier) {
                if (deviceInfo?.temperature?.celsius ?? false) {
                    this.emit('temperature', deviceInfo?.temperature?.celsius);
                }
            }
        });
    }
}

export class FritzButton extends FritzTemperatureSensor {
    constructor(client: FritzClient, deviceInfo: DeviceInfo) {
        super(client, deviceInfo);
    }
}

export class FritzBulb extends FritzDevice {
    constructor(client: FritzClient, deviceInfo: DeviceInfo) {
        super(client, deviceInfo);

        client.on('info', (deviceInfo: DeviceInfo) => {
            if (deviceInfo.identifier == this.deviceInfo.identifier) {
                if (deviceInfo?.simpleonoff) {
                    this.emit('on', deviceInfo.simpleonoff.state);
                }

                if (deviceInfo?.levelcontrol?.levelpercentage) {
                    this.emit('brightness', deviceInfo.levelcontrol.levelpercentage);
                }

                if (deviceInfo?.colorcontrol?.temperature) {
                    this.emit('colorTemperature', deviceInfo.colorcontrol.temperature);
                }

                if (deviceInfo?.colorcontrol?.color) {
                    this.emit('color', deviceInfo.colorcontrol.color);
                }
            }
        });
    }

    public async setOn(on: boolean) {
        await this.client.invoke('setsimpleonoff', {
            ain: this.deviceInfo.identifier,
            onoff: on ? 1 : 0
        });
    }

    public async setBrightness(percent: number) {
        await this.client.invoke('setlevelpercentage', {
            ain: this.deviceInfo.identifier,
            level: percent
        });
    }

    public async setColor(color: SubColor) {
        await this.client.invoke('setcolor', {
            ain: this.deviceInfo.identifier,
            hue: color.hue,
            saturation: color.sat,
            duration: 0
        });
    }

    public async setTemperature(temperature: ColorTemperature) {
        await this.client.invoke('setcolortemperature', {
            ain: this.deviceInfo.identifier,
            temperature: temperature.kelvin,
            duration: 0
        });
    }
}

const COLOR_MODE_HUE_SAT = 1;
const COLOR_MODE_COLOR_TEMPERATURE = 4;

const FEATURES = [
    'HAN-FUN',
    'Reserved',
    'Light',
    'Reserved',
    'AlarmSensor',
    'Button',
    'Thermostat',
    'EnergyMeter',
    'TemperatureSensor',
    'SmartPlug',
    'DECTRepeater',
    'Microphone',
    'Reserved',
    'HAN-FUN',
    'Reserved',
    'OnOffActor',
    'DimmableLight',
    'ColorLight'
]

export class FritzClient extends EventEmitter {
    private constructor(private host: string, private sessionId: string, private debug?: boolean) {
        super();
    }

    public async getBulbs() {
        return (await this.getDeviceInfos())
            .filter(device => device.features.indexOf('Light') > -1)
            .map(deviceInfo => new FritzBulb(this, deviceInfo));
    }

    public async getButtons() {
        return (await this.getDeviceInfos())
            .filter(device => device.features.indexOf('Button') > -1)
            .map(deviceInfo => new FritzButton(this, deviceInfo));
    }

    public async update() {
        const deviceInfos = await this.getDeviceInfos();

        for (const deviceInfo of deviceInfos) {
            this.emit('info', deviceInfo);
        }
    }

    public async getDeviceInfos(): Promise<DeviceInfo[]> {
        const body: string = await this.invoke('getdevicelistinfos');
        const deviceInfos: DeviceInfosResponse = await parseStringPromise(body);

        if (this.debug) {
            console.log(body);
            console.log(deviceInfos);
        }

        return deviceInfos.devicelist.device.map(device => {
            const identifier = device.$.identifier.replace(' ', '');
            const productname = device.$.productname;
            const name = device.name[0];
            const functionMask = parseInt(device.$.functionbitmask);

            const features = [];

            for (let i = 0; i < FEATURES.length; i++) {
                if (functionMask & (0x01 << i)) {
                    features.push(FEATURES[i]);
                }
            }

            const result: DeviceInfo = {
                identifier,
                productname,
                name,
                features
            };

            if (device?.simpleonoff && device?.simpleonoff[0] && device?.simpleonoff[0]?.state[0]) {
                const state = device?.simpleonoff[0]?.state[0] == '1';

                result.simpleonoff = {
                    state
                }
            }

            if (device?.levelcontrol && device?.levelcontrol[0]) {
                const level = parseInt(device?.levelcontrol[0]?.level[0]);
                const levelpercentage = parseInt(device?.levelcontrol[0]?.levelpercentage[0]);

                result.levelcontrol = {
                    level,
                    levelpercentage
                }
            }

            if (device?.colorcontrol && device?.colorcontrol[0]?.$?.current_mode) {
                const current_mode = parseInt(device?.colorcontrol[0]?.$?.current_mode);

                switch (current_mode) {
                    case COLOR_MODE_HUE_SAT:
                        const hue = parseInt(device?.colorcontrol[0]?.hue[0]);
                        const sat = parseInt(device?.colorcontrol[0]?.saturation[0]);

                        result.colorcontrol = {
                            color: {
                                hue,
                                sat
                            }
                        }
                        break;
                    case COLOR_MODE_COLOR_TEMPERATURE:
                        result.colorcontrol = {
                            temperature: parseInt(device?.colorcontrol[0]?.temperature[0])
                        }
                        break;
                }
            }

            if (device?.battery && device?.battery[0]) {
                result.battery = parseInt(device?.battery[0]);
            }

            if (device?.batterylow && device?.batterylow[0]) {
                result.batterylow = device?.batterylow[0] == '1';
            }

            if (device?.temperature && device?.temperature[0]) {
                const celsius = parseInt(device?.temperature[0]?.celsius[0]) / 10;
                const offset = parseInt(device?.temperature[0]?.offset[0]) / 10;

                result.temperature = {
                    celsius,
                    offset
                };
            }

            if (device?.hkr && device?.hkr[0]) {
                const currentTemperature = parseInt(device?.hkr[0]?.tist[0]) * 0.5;
                const targetTemperature = parseInt(device?.hkr[0]?.tsoll[0]) * 0.5;

                result.thermostat = {
                    currentTemperature,
                    targetTemperature
                }
            }

            if (device?.switch && device?.switch[0] && device?.switch[0]?.state[0]) {
                const state = device?.switch[0]?.state[0] == '1';

                result.switch = {
                    state
                }
            }

            if (device?.powermeter && device?.powermeter[0] && device?.powermeter[0]) {
                const voltage = parseInt(device?.powermeter[0].voltage[0]) / 1000;
                const power = parseInt(device?.powermeter[0].power[0]) / 1000;
                const energy = parseInt(device?.powermeter[0].energy[0]);

                result.powermeter = {
                    voltage,
                    power,
                    energy
                }
            }

            return result;
        });
    }

    public async getColorDefaults(): Promise<ColorDefaults> {
        const body = await this.invoke('getcolordefaults');
        const defaults: ColorDefaultsResponse = await parseStringPromise(body);

        const colors = defaults.colordefaults.hsdefaults[0].hs.map(hs => {
            const name = hs.name[0]._;
            const colors = hs.color.map(color => {
                return {
                    sat_index: parseInt(color.$.sat_index),
                    hue: parseInt(color.$.hue),
                    sat: parseInt(color.$.sat),
                    val: parseInt(color.$.val)
                }
            });

            return {
                name,
                colors
            }
        });

        const colorTemperatures = defaults.colordefaults.temperaturedefaults[0].temp.map(temperature => {
            return { kelvin: parseInt(temperature.$.value) }
        });

        return {
            colors,
            colorTemperatures
        };
    }

    public async invoke(method: string, args: {} = {}): Promise<string> {
        const queryParams = {
            ...args,
            switchcmd: method,
            sid: this.sessionId
        }

        const query = Object.entries(queryParams)
            .map(([key, value]) => `${key}=${value}`)
            .reduce((prev, cur) => `${prev}&${cur}`)
            .replace(' ', '');

        const response = await fetch(`${this.host}//webservices/homeautoswitch.lua?${query}`);

        return await response.text();
    }

    public static async login(host: string, username: string, password: string, debug?: boolean): Promise<FritzClient> {
        const challengeInfo = await FritzClient.getChallenge(host);
        const challenge = challengeInfo.SessionInfo.Challenge[0];
        const sessionInfo = await this.createSession(host, username, password, challenge);
        const sessionId = sessionInfo?.SessionInfo?.SID[0];

        if (sessionId == '0000000000000000') {
            throw new Error('Invalid user or password');
        }

        const rights = sessionInfo?.SessionInfo.Rights
            .filter(right => right.Name)
            .map(right => right.Name[0]);

        console.log(`User rights: ${JSON.stringify(rights)}`);

        if (rights.indexOf('HomeAuto') == -1) {
            console.warn('User needs "HomeAuto" access rights');
        }

        return new FritzClient(host, sessionId, debug);
    }

    public static async getChallenge(host: string): Promise<SessionInfoResponse> {
        const response = await fetch(`${host}/login_sid.lua`);
        const body = await response.text();

        return await parseStringPromise(body);
    };

    public static async createSession(host: string, username: string, password: string, challenge: string): Promise<SessionInfoResponse> {
        const md5 = createHash('md5');
        md5.update(Buffer.from(`${challenge}-${password}`, 'utf16le'));
        const challengeResponse = `${challenge}-${md5.digest('hex')}`;

        const response = await fetch(`${host}/login_sid.lua?username=${username}&response=${challengeResponse}`);
        const body = await response.text();

        return await parseStringPromise(body);
    };
}
