/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

'use strict';

import {Fritz} from 'fritzapi';
import {Adapter, AddonManagerProxy, Device, Event, Property} from 'gateway-addon';
import {Config} from './config';
import {Color, SubColor, ColorDefaults, FritzBulb, FritzClient, FritzButton, FritzDevice, FritzTemperatureSensor} from './fritz-client';

export class SwitchProperty extends Property<boolean> {
  // eslint-disable-next-line no-unused-vars
  constructor(
    private fritzDect200: FritzDect200,
    // eslint-disable-next-line no-unused-vars
    private client: Fritz,
    // eslint-disable-next-line no-unused-vars
    private log: (message?: unknown, ...optionalParams: unknown[]) => void) {
    super(fritzDect200, 'state', {
      type: 'boolean',
      '@type': 'OnOffProperty',
      title: 'State',
      description: 'The state of the switch',
    });
  }

  async setValue(value: boolean): Promise<boolean> {
    try {
      this.log(`Set value of ${this.fritzDect200.getTitle()} / ${this.getTitle()} to ${value}`);
      const ain = this.fritzDect200.deviceInfo.identifier;

      if (value === true) {
        await this.client.setSwitchOn(ain);
        this.log('Set switch on');
      } else {
        await this.client.setSwitchOff(ain);
        this.log('Set switch off');
      }

      return super.setValue(value);
    } catch (e) {
      this.log(`Could not set value: ${e}`);
      return Promise.reject(e);
    }
  }
}

class FritzDect200 extends Device {
  private switchProperty: SwitchProperty;

  private temperatureProperty: TemperatureProperty;

  constructor(
    adapter: Adapter,
    private client: Fritz,
    public deviceInfo: DeviceInfo,
    // eslint-disable-next-line no-unused-vars
    log: (message?: unknown, ...optionalParams: unknown[]) => void) {
    super(adapter, deviceInfo.identifier);
    this['@context'] = 'https://iot.mozilla.org/schemas/';
    this['@type'] = ['SmartPlug', 'TemperatureSensor'];
    this.setTitle(deviceInfo.name);
    this.setDescription(deviceInfo.productname);

    this.switchProperty = new SwitchProperty(this, client, log);
    this.addProperty(this.switchProperty);

    this.temperatureProperty = new TemperatureProperty(this);
    this.addProperty(this.temperatureProperty);
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

class TemperatureProperty extends Property<number> {
  constructor(device: Device) {
    super(device, 'temperature', {
      type: 'number',
      '@type': 'TemperatureProperty',
      unit: 'degree celsius',
      multipleOf: 0.5,
      title: 'Temperature',
      description: 'The ambient temperature',
      readOnly: true,
    });
  }
}

class SetTemperatureProperty extends Property<number> {
  constructor(
    // eslint-disable-next-line no-unused-vars
    private fritzThermostat: FritzThermostat, private client: Fritz,
    // eslint-disable-next-line no-unused-vars
    private log: (message?: unknown, ...optionalParams: unknown[]) => void) {
    super(fritzThermostat, 'settemperature', {
      '@type': 'LevelProperty',
      type: 'number',
      minimum: 8,
      maximum: 28,
      multipleOf: 0.5,
      unit: 'degree celsius',
      title: 'Set Temperature',
      description: 'The set temperature',
    });
  }

  async setValue(value: number) {
    try {
      this.log(`Set value of ${this.getDevice().getTitle()} / ${this.getTitle()} to ${value}`);
      const ain = this.fritzThermostat.deviceInfo.identifier;
      await this.client.setTempTarget(ain, value);
      return super.setValue(value);
    } catch (e) {
      this.log(`Could not set value: ${e}`);
      return Promise.reject(e);
    }
  }
}

class FritzThermostat extends Device {
  private setTemperatureProperty: SetTemperatureProperty;

  private temperatureProperty: TemperatureProperty;

  constructor(
    // eslint-disable-next-line no-unused-vars
    adapter: Adapter, private client: Fritz, public deviceInfo: DeviceInfo,
    // eslint-disable-next-line no-unused-vars
    log: (message?: unknown, ...optionalParams: unknown[]) => void) {
    super(adapter, deviceInfo.identifier);
    this['@context'] = 'https://iot.mozilla.org/schemas/';
    this['@type'] = ['TemperatureSensor'];
    this.setTitle(deviceInfo.name);
    this.setDescription(deviceInfo.productname);

    this.setTemperatureProperty = new SetTemperatureProperty(this, client, log);
    this.addProperty(this.setTemperatureProperty);

    this.temperatureProperty = new TemperatureProperty(this);
    this.addProperty(this.temperatureProperty);
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

class OnOffProperty extends Property<boolean> {
  constructor(
    private fritzColorBulb: FritzColorBulb, private bulb: FritzBulb,
    // eslint-disable-next-line no-unused-vars
    private log: (message?: unknown, ...optionalParams: unknown[]) => void) {
    super(fritzColorBulb, 'on', {
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
      this.log(`Set value of ${this.fritzColorBulb.getTitle()} / ${this.getTitle()} to ${value}`);
      await this.bulb.setOn(value);
      return super.setValue(value);
    } catch (e) {
      this.log(`Could not set value: ${e}`);
      return Promise.reject(e);
    }
  }
}

class BrightnessProperty extends Property<number> {
  constructor(
    private fritzColorBulb: FritzColorBulb, private bulb: FritzBulb,
    // eslint-disable-next-line no-unused-vars
    private log: (message?: unknown, ...optionalParams: unknown[]) => void) {
    super(fritzColorBulb, 'brightness', {
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
      this.log(`Set value of ${this.fritzColorBulb.getTitle()} / ${this.getTitle()} to ${value}`);
      await this.bulb.setBrightness(value);
      return super.setValue(value);
    } catch (e) {
      this.log(`Could not set value: ${e}`);
      return Promise.reject(e);
    }
  }
}

class ColorTemperatureProperty extends Property<string> {
  constructor(
    private fritzColorBulb: FritzColorBulb, private bulb: FritzBulb, temperatures: string[],
    // eslint-disable-next-line no-unused-vars
    private log: (message?: unknown, ...optionalParams: unknown[]) => void) {
    super(fritzColorBulb, 'colorTemperaturePreset', {
      type: 'string',
      title: 'Color temperature',
      enum: temperatures,
    });

    bulb.on('colorTemperature', (colorTemperature: number) => {
      this.setCachedValueAndNotify(`${colorTemperature}`);
    });
  }

  async setValue(value: string) {
    try {
      this.log(`Set value of ${this.fritzColorBulb.getTitle()} / ${this.getTitle()} to ${value}`);
      await this.bulb.setTemperature({kelvin: parseInt(value)});
      return super.setValue(value);
    } catch (e) {
      this.log(`Could not set value: ${e}`);
      return Promise.reject(e);
    }
  }
}

class ColorProperty extends Property<string> {
  constructor(
    private fritzColorBulb: FritzColorBulb, private bulb: FritzBulb, private subColors: { [key: string]: SubColor },
    // eslint-disable-next-line no-unused-vars
    private log: (message?: unknown, ...optionalParams: unknown[]) => void) {
    super(fritzColorBulb, 'colorPreset', {
      type: 'string',
      title: 'Color',
      enum: Object.keys(subColors),
    });

    bulb.on('color', (color: Color) => {
      for (const [name, subColor] of Object.entries(subColors)) {
        if (subColor.hue == color.hue && subColor.sat == color.sat) {
          this.setCachedValueAndNotify(name);
          return;
        }
      }

      console.warn(`No color preset for ${JSON.stringify(color)} found`);
    });
  }

  async setValue(value: string) {
    try {
      this.log(`Set value of ${this.fritzColorBulb.getTitle()} / ${this.getTitle()} to ${value}`);
      const color = this.subColors[value];
      if (!color) {
        throw new Error(`Unknown color ${value}`);
      }
      await this.bulb.setColor(color);
      return super.setValue(value);
    } catch (e) {
      this.log(`Could not set value: ${e}`);
      return Promise.reject(e);
    }
  }
}

class FritzColorBulb extends Device {
  private onOffProperty: OnOffProperty;

  private brightnessProperty: BrightnessProperty;

  private colorTemperatureProperty: ColorTemperatureProperty;

  private colorProperty: ColorProperty;

  constructor(
    // eslint-disable-next-line no-unused-vars
    adapter: Adapter, bulb: FritzBulb, colorDefaults: ColorDefaults, log: (message?: unknown, ...optionalParams: unknown[]) => void) {
    super(adapter, bulb.getAin());
    this['@context'] = 'https://iot.mozilla.org/schemas/';
    this['@type'] = ['Light'];
    this.setTitle(bulb.getName());

    this.onOffProperty = new OnOffProperty(this, bulb, log);
    this.addProperty(this.onOffProperty);

    this.brightnessProperty = new BrightnessProperty(this, bulb, log);
    this.addProperty(this.brightnessProperty);

    const temperatures = colorDefaults.colorTemperatures.map((x) => x.kelvin).map((x) => `${x}`);
    this.colorTemperatureProperty = new ColorTemperatureProperty(this, bulb, temperatures, log);
    this.addProperty(this.colorTemperatureProperty);


    const colors: { [key: string]: SubColor } = {};

    for (const mainColor of colorDefaults.colors) {
      for (const subColor of mainColor.colors) {
        const name = `${mainColor.name}_${subColor.sat_index}`;
        colors[name] = subColor;
      }
    }

    this.colorProperty = new ColorProperty(this, bulb, colors, log);
    this.addProperty(this.colorProperty);
  }
}

class BatteryProperty extends Property<number> {
  constructor(device: Device, fritzDevice: FritzDevice) {
    super(device, 'battery', {
      '@type': 'LevelProperty',
      type: 'integer',
      minimum: 0,
      maximum: 100,
      unit: 'percent',
      title: 'Battery',
      readOnly: true,
    });

    fritzDevice.on('battery', (battery: number) => {
      this.setCachedValueAndNotify(battery);
    });
  }
}

class BatterylowProperty extends Property<boolean> {
  constructor(device: Device, fritzDevice: FritzDevice) {
    super(device, 'batterylow', {
      type: 'boolean',
      unit: 'batterylow',
      title: 'Battery low',
      readOnly: true,
    });

    fritzDevice.on('batterylow', (batterylow: boolean) => {
      this.setCachedValueAndNotify(batterylow);
    });
  }
}

class TemperatureSensorProperty extends Property<number> {
  constructor(device: Device, fritzDevice: FritzTemperatureSensor) {
    super(device, 'temperature', {
      type: 'number',
      '@type': 'TemperatureProperty',
      unit: 'degree celsius',
      multipleOf: 0.5,
      title: 'Temperature',
      description: 'The ambient temperature',
      readOnly: true,
    });

    fritzDevice.on('temperature', (temperature: number) => {
      this.setCachedValueAndNotify(temperature);
    });
  }
}

export class BasicDevice extends Device {
  constructor(adapter: Adapter, button: FritzDevice) {
    super(adapter, button.getAin());
    this['@context'] = 'https://iot.mozilla.org/schemas/';
    this['@type'] = [];
    this.setTitle(button.getName());

    if (button.hasBattery()) {
      this.addProperty(new BatteryProperty(this, button));
      this.addProperty(new BatterylowProperty(this, button));
    }
  }
}

export class TemperatureSensor extends BasicDevice {
  constructor(adapter: Adapter, button: FritzButton) {
    super(adapter, button);
    this['@context'] = 'https://iot.mozilla.org/schemas/';
    this['@type'] = ['TemperatureSensor'];
    this.setTitle(button.getName());

    this.addProperty(new TemperatureSensorProperty(this, button));
  }
}

export class Button extends TemperatureSensor {
  constructor(adapter: Adapter, button: FritzButton) {
    super(adapter, button);
    this['@type'].push('PushButton');

    for (const subButton of button.getButtons()) {
      this.addEvent(subButton.id, {
        name: subButton.id,
        metadata: {
          '@type': 'PressedEvent',
          description: 'Button pressed',
          type: 'string',
        },
      });
    }

    button.on('press', (buttonId) => this.eventNotify(new Event(this, buttonId)));
  }
}

interface DeviceInfo {
  productname: string;
  name: string;
  identifier: string;
}

export class FritzAdapter extends Adapter {
  // eslint-disable-next-line no-unused-vars
  private log: (message?: unknown, ...optionalParams: unknown[]) => void;

  constructor(addonManager: AddonManagerProxy, id: string, private config: Config) {
    super(addonManager, FritzAdapter.name, id);
    addonManager.addAdapter(this);
    const {
      debug,
      username,
      password,
      host,
      pollInterval,
    } = config;

    if (debug) {
      this.log = console.log;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      this.log = () => {};
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
    this.discover(client, pollInterval, debug);
  }

  async discover(client: Fritz, pollInterval: number, debug: boolean): Promise<void> {
    const deviceInfos: DeviceInfo[] = await client.getDeviceList();

    for (const deviceInfo of deviceInfos) {
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
      password,
    } = this.config;

    const fritzClient = await FritzClient.login(host || 'http://fritz.box', username, password, debug);

    const devices = await fritzClient.getDeviceInfos();

    for (const deviceInfo of devices) {
      console.log(`Detected new ${deviceInfo.productname} with ain ${deviceInfo.identifier}`);
      this.log(JSON.stringify(deviceInfo));
    }

    const colorDefaults = await fritzClient.getColorDefaults();
    const bulbs = await fritzClient.getBulbs();

    for (const bulb of bulbs) {
      console.log(`Detected new ${bulb}`);
      const device = new FritzColorBulb(this, bulb, colorDefaults, this.log);
      this.handleDeviceAdded(device);
    }

    const buttons = await fritzClient.getButtons();

    for (const button of buttons) {
      console.log(`Detected new ${button}`);
      const device = new Button(this, button);
      this.handleDeviceAdded(device);
    }

    setInterval(() => fritzClient.update(), pollInterval * 1000);
  }
}
