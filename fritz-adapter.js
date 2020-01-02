/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

'use strict';

const Fritz = require('fritzapi').Fritz;

const {
  Adapter,
  Device,
  Property
} = require('gateway-addon');

function stdout() {
  console.log.apply(console, arguments);
}

class SwitchProperty extends Property {
  constructor(device, client, log) {
    super(device, 'state', {
      type: 'boolean',
      '@type': 'OnOffProperty',
      title: 'State',
      description: 'The state of the switch'
    });

    this.client = client;
    this.log = log;
  }

  async setValue(value) {
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
  constructor(adapter, client, deviceInfo, log) {
    super(adapter, deviceInfo.identifier);
    this['@context'] = 'https://iot.mozilla.org/schemas/';
    this['@type'] = ['SmartPlug'];
    this.name = deviceInfo.name;
    this.description = deviceInfo.productname;
    this.client = client;
    this.deviceInfo = deviceInfo;
    this.log = log;
    this.switchProperty = new SwitchProperty(this, client, log);
    this.properties.set(this.switchProperty.name, this.switchProperty);
  }

  startPolling(interval) {
    this.poll();
    this.timer = setInterval(() => {
      this.poll();
    }, interval * 1000);
  }

  async poll() {
    const info = await this.client.getDevice(this.deviceInfo.identifier);
    this.switchProperty.setCachedValueAndNotify(info.switch.state === '1');
  }
}

class TemperatureProperty extends Property {
  constructor(device) {
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
  constructor(device, client, log) {
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

    this.client = client;
    this.log = log;
  }

  async setValue(value) {
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
  constructor(adapter, client, deviceInfo, log) {
    super(adapter, deviceInfo.identifier);
    this['@context'] = 'https://iot.mozilla.org/schemas/';
    this['@type'] = ['TemperatureSensor'];
    this.name = deviceInfo.name;
    this.description = deviceInfo.productname;
    this.client = client;
    this.deviceInfo = deviceInfo;
    this.log = log;
    this.setTemperatureProperty = new SetTemperatureProperty(this, client, log);
    // eslint-disable-next-line max-len
    this.properties.set(this.setTemperatureProperty.name, this.setTemperatureProperty);
    this.temperatureProperty = new TemperatureProperty(this);
    // eslint-disable-next-line max-len
    this.properties.set(this.temperatureProperty.name, this.temperatureProperty);
  }

  startPolling(interval) {
    this.poll();
    this.timer = setInterval(() => {
      this.poll();
    }, interval * 1000);
  }

  async poll() {
    // eslint-disable-next-line max-len
    const temperature = await this.client.getTemperature(this.deviceInfo.identifier);
    this.temperatureProperty.setCachedValueAndNotify(temperature);

    // eslint-disable-next-line max-len
    const setTemperature = await this.client.getTempTarget(this.deviceInfo.identifier);
    this.setTemperatureProperty.setCachedValueAndNotify(setTemperature);
  }
}

class FritzAdapter extends Adapter {
  constructor(addonManager, manifest) {
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
      this.log = stdout;
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

  async discover(client, pollInterval) {
    const deviceInfos = await client.getDeviceList();

    for (const deviceInfo of deviceInfos) {
      // eslint-disable-next-line max-len
      if (deviceInfo.productname === 'FRITZ!DECT 200') {
        // eslint-disable-next-line max-len
        console.log(`Detected new ${deviceInfo.productname} with ain ${deviceInfo.identifier}`);
        // eslint-disable-next-line max-len
        const fritzDect200 = new FritzDect200(this, client, deviceInfo, this.log);
        this.handleDeviceAdded(fritzDect200);
        fritzDect200.startPolling(pollInterval);
      }
    }

    const thermostatAins = await client.getThermostatList();

    for (const thermostatAin of thermostatAins) {
      const deviceInfo = await client.getDevice(thermostatAin);
      // eslint-disable-next-line max-len
      console.log(`Detected new ${deviceInfo.productname} with ain ${deviceInfo.identifier}`);
      // eslint-disable-next-line max-len
      const fritzThermostat = new FritzThermostat(this, client, deviceInfo, this.log);
      this.handleDeviceAdded(fritzThermostat);
      fritzThermostat.startPolling(pollInterval);
    }
  }
}

module.exports = FritzAdapter;
