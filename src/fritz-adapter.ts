/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

'use strict';

import { Fritz } from 'fritzapi';

import { Adapter, Device, Property } from 'gateway-addon';

import { Color, SubColor, ColorDefaults, FritzBulb, FritzClient } from './fritz-client';

export class SwitchProperty extends Property {
  constructor(private device: FritzDect200, private client: Fritz, private log: (message?: any, ...optionalParams: any[]) => void) {
    super(device, 'state', {
      type: 'boolean',
      '@type': 'OnOffProperty',
      title: 'State',
      description: 'The state of the switch'
    });
  }

  async setValue(value: boolean) {
    try {
      this.log(`Set value of ${this.device.name} / ${this.title} to ${value}`);
      super.setValue(value);
      const ain = this.device.deviceInfo.identifier;

      if (value === true) {
        await this.client.setSwitchOn(ain);
        this.log('Set switch on');
      } else {
        await this.client.setSwitchOff(ain);
        this.log('Set switch off');
      }
    } catch (e) {
      this.log(`Could not set value: ${e}`);
    }
  }
}

class FritzDect200 extends Device {
  private switchProperty: SwitchProperty;
  private temperatureProperty: TemperatureProperty;

  constructor(adapter: Adapter, private client: Fritz, public deviceInfo: any, log: (message?: any, ...optionalParams: any[]) => void) {
    super(adapter, deviceInfo.identifier);
    this['@context'] = 'https://iot.mozilla.org/schemas/';
    this['@type'] = ['SmartPlug', 'TemperatureSensor'];
    this.name = deviceInfo.name;
    this.description = deviceInfo.productname;

    this.switchProperty = new SwitchProperty(this, client, log);
    this.properties.set(this.switchProperty.name, this.switchProperty);

    this.temperatureProperty = new TemperatureProperty(this);
    this.properties.set(this.temperatureProperty.name, this.temperatureProperty);
  }

  startPolling(interval: number) {
    this.poll();

    setInterval(() => {
      this.poll();
    }, interval * 1000);
  }

  async poll() {
    const info = await this.client.getDevice(this.deviceInfo.identifier);
    this.switchProperty.setCachedValueAndNotify(info.switch.state === '1');

    const temperature = await this.client.getTemperature(this.deviceInfo.identifier);
    this.temperatureProperty.setCachedValueAndNotify(temperature);
  }
}

class TemperatureProperty extends Property {
  constructor(device: Device) {
    super(device, 'temperature', {
      type: 'number',
      '@type': 'TemperatureProperty',
      unit: 'degree celsius',
      multipleOf: 0.5,
      title: 'Temperature',
      description: 'The ambient temperature',
      readOnly: true
    });
  }
}

class SetTemperatureProperty extends Property {
  constructor(private device: FritzThermostat, private client: Fritz, private log: (message?: any, ...optionalParams: any[]) => void) {
    super(device, 'settemperature', {
      '@type': 'LevelProperty',
      type: 'number',
      minimum: 8,
      maximum: 28,
      multipleOf: 0.5,
      unit: 'degree celsius',
      title: 'Set Temperature',
      description: 'The set temperature'
    });
  }

  async setValue(value: number) {
    try {
      this.log(`Set value of ${this.device.name} / ${this.title} to ${value}`);
      super.setValue(value);
      const ain = this.device.deviceInfo.identifier;
      await this.client.setTempTarget(ain, value);
    } catch (e) {
      this.log(`Could not set value: ${e}`);
    }
  }
}

class FritzThermostat extends Device {
  private setTemperatureProperty: SetTemperatureProperty;
  private temperatureProperty: TemperatureProperty;

  constructor(adapter: Adapter, private client: Fritz, public deviceInfo: any, log: (message?: any, ...optionalParams: any[]) => void) {
    super(adapter, deviceInfo.identifier);
    this['@context'] = 'https://iot.mozilla.org/schemas/';
    this['@type'] = ['TemperatureSensor'];
    this.name = deviceInfo.name;
    this.description = deviceInfo.productname;

    this.setTemperatureProperty = new SetTemperatureProperty(this, client, log);
    this.properties.set(this.setTemperatureProperty.name, this.setTemperatureProperty);

    this.temperatureProperty = new TemperatureProperty(this);
    this.properties.set(this.temperatureProperty.name, this.temperatureProperty);
  }

  startPolling(interval: number) {
    this.poll();
    setInterval(() => {
      this.poll();
    }, interval * 1000);
  }

  async poll() {
    const temperature = await this.client.getTemperature(this.deviceInfo.identifier);
    this.temperatureProperty.setCachedValueAndNotify(temperature);

    const setTemperature = await this.client.getTempTarget(this.deviceInfo.identifier);
    this.setTemperatureProperty.setCachedValueAndNotify(setTemperature);
  }
}

class OnOffProperty extends Property {
  constructor(private device: FritzColorBulb, private bulb: FritzBulb, private log: (message?: any, ...optionalParams: any[]) => void) {
    super(device, 'on', {
      '@type': 'OnOffProperty',
      type: 'boolean',
      title: 'On',
    });

    bulb.on('on', (on: boolean) => {
      this.setCachedValueAndNotify(on);
    });
  }

  async setValue(value: boolean) {
    try {
      this.log(`Set value of ${this.device.name} / ${this.title} to ${value}`);
      super.setValue(value);
      await this.bulb.setOn(value);
    } catch (e) {
      this.log(`Could not set value: ${e}`);
    }
  }
}

class BrightnessProperty extends Property {
  constructor(private device: FritzColorBulb, private bulb: FritzBulb, private log: (message?: any, ...optionalParams: any[]) => void) {
    super(device, 'brightness', {
      '@type': 'BrightnessProperty',
      type: 'integer',
      minimum: 0,
      maximum: 100,
      unit: 'percent',
      title: 'Brightness',
    });

    bulb.on('brightness', (brightness: number) => {
      this.setCachedValueAndNotify(brightness);
    });
  }

  async setValue(value: number) {
    try {
      this.log(`Set value of ${this.device.name} / ${this.title} to ${value}`);
      super.setValue(value);
      await this.bulb.setBrightness(value);
    } catch (e) {
      this.log(`Could not set value: ${e}`);
    }
  }
}

class ColorTemperatureProperty extends Property {
  constructor(private device: FritzColorBulb, private bulb: FritzBulb, temperatures: string[], private log: (message?: any, ...optionalParams: any[]) => void) {
    super(device, 'colorTemperaturePreset', {
      type: 'string',
      title: 'Color temperature',
      enum: temperatures
    });

    bulb.on('colorTemperature', (colorTemperature: number) => {
      this.setCachedValueAndNotify(colorTemperature);
    });
  }

  async setValue(value: string) {
    try {
      this.log(`Set value of ${this.device.name} / ${this.title} to ${value}`);
      super.setValue(value);
      await this.bulb.setTemperature({ kelvin: parseInt(value) });
    } catch (e) {
      this.log(`Could not set value: ${e}`);
    }
  }
}

class ColorProperty extends Property {
  constructor(private device: FritzColorBulb, private bulb: FritzBulb, private subColors: { [key: string]: SubColor }, private log: (message?: any, ...optionalParams: any[]) => void) {
    super(device, 'colorPreset', {
      type: 'string',
      title: 'Color',
      enum: Object.keys(subColors)
    });

    bulb.on('color', (color: Color) => {
      for (const [name, subColor] of Object.entries(subColors)) {
        if (subColor.hue == color.hue && subColor.sat == subColor.sat) {
          this.setCachedValueAndNotify(name);
          return;
        }
      }

      console.warn(`No color preset for ${JSON.stringify(color)} found`);
    });
  }

  async setValue(value: string) {
    try {
      this.log(`Set value of ${this.device.name} / ${this.title} to ${value}`);
      const color = this.subColors[value];
      if (!color) {
        throw new Error(`Unknown color ${value}`);
      }
      super.setValue(value);
      await this.bulb.setColor(color);
    } catch (e) {
      this.log(`Could not set value: ${e}`);
    }
  }
}

class FritzColorBulb extends Device {
  private onOffProperty: OnOffProperty;
  private brightnessProperty: BrightnessProperty;
  private colorTemperatureProperty: ColorTemperatureProperty;
  private colorProperty: ColorProperty;

  constructor(adapter: Adapter, bulb: FritzBulb, colorDefaults: ColorDefaults, log: (message?: any, ...optionalParams: any[]) => void) {
    super(adapter, bulb.getAin());
    this['@context'] = 'https://iot.mozilla.org/schemas/';
    this['@type'] = ['Light'];
    this.name = bulb.getName();

    this.onOffProperty = new OnOffProperty(this, bulb, log);
    this.properties.set(this.onOffProperty.name, this.onOffProperty);

    this.brightnessProperty = new BrightnessProperty(this, bulb, log);
    this.properties.set(this.brightnessProperty.name, this.brightnessProperty);

    const temperatures = colorDefaults.colorTemperatures.map(x => x.kelvin).map(x => `${x}`);
    this.colorTemperatureProperty = new ColorTemperatureProperty(this, bulb, temperatures, log);
    this.properties.set(this.colorTemperatureProperty.name, this.colorTemperatureProperty);


    const colors: { [key: string]: SubColor } = {};

    for (const mainColor of colorDefaults.colors) {
      for (const subColor of mainColor.colors) {
        const name = `${mainColor.name}_${subColor.sat_index}`
        colors[name] = subColor;
      }
    }

    this.colorProperty = new ColorProperty(this, bulb, colors, log);
    this.properties.set(this.colorProperty.name, this.colorProperty);
  }
}

export class FritzAdapter extends Adapter {
  private log: (message?: any, ...optionalParams: any[]) => void;

  constructor(addonManager: any, private manifest: any) {
    super(addonManager, FritzAdapter.name, manifest.name);
    addonManager.addAdapter(this);
    const {
      debug,
      username,
      password,
      host,
      pollInterval
    } = manifest.moziot.config;

    if (debug) {
      this.log = console.log;
    } else {
      this.log = () => { };
    }

    if (!username) {
      console.warn('Please specify username in the config');
      return;
    }

    if (!password) {
      console.warn('Please specify password in the config');
      return;
    }

    const client = new Fritz(username, password, host);
    this.discover(client, pollInterval);
  }

  async discover(client: Fritz, pollInterval: number) {
    const deviceInfos = await client.getDeviceList();

    for (const deviceInfo of deviceInfos) {
      console.log(`Detected new ${deviceInfo.productname} with ain ${deviceInfo.identifier}`);

      if (deviceInfo.productname === 'FRITZ!DECT 200' || deviceInfo.productname === 'FRITZ!DECT 210') {
        const fritzDect200 = new FritzDect200(this, client, deviceInfo, this.log);
        this.handleDeviceAdded(fritzDect200);
        fritzDect200.startPolling(pollInterval);
      }
    }

    const thermostatAins = await client.getThermostatList();

    for (const thermostatAin of thermostatAins) {
      const deviceInfo = await client.getDevice(thermostatAin);

      console.log(`Detected new ${deviceInfo.productname} with ain ${deviceInfo.identifier}`);

      const fritzThermostat = new FritzThermostat(this, client, deviceInfo, this.log);
      this.handleDeviceAdded(fritzThermostat);
      fritzThermostat.startPolling(pollInterval);
    }

    const {
      host,
      username,
      password
    } = this.manifest.moziot.config;

    const fritzClient = await FritzClient.login(host || 'http://fritz.box', username, password);
    const colorDefaults = await fritzClient.getColorDefaults();
    const bulbs = await fritzClient.getBulbs();

    for (const bulb of bulbs) {
      console.log(`Detected new ${bulb}`);
      const device = new FritzColorBulb(this, bulb, colorDefaults, this.log);
      this.handleDeviceAdded(device);
    }

    setInterval(() => fritzClient.update(), pollInterval * 1000);
  }
}
