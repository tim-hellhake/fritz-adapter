/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

declare module 'fritzapi' {
    class Fritz {
        constructor(device: any, name: string, data?: any);
        setSwitchOn(ain: string): void;
        setSwitchOff(ain: string): void;
        getDevice(identifier: string): Promise<any>;
        setTempTarget(ain: string, value: number): void;
        getTemperature(identifier: string): number;
        getTempTarget(identifier: string): number;
        getDeviceList(): Promise<any[]>;
        getThermostatList(): Promise<any[]>;
        getColorBulbList(): Promise<any[]>;
        setSimpleOnOff(ain: any, value: number): void;
        setLevel(ain: any, level: number): void;
        setColorTemperature(ain: any, temperature: number, duration: number): void;
        setColor(ain: any, color: string, satindex: number, duration: number): void;
    }
}
