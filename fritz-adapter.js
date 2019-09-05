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

class SwitchProperty extends Property {
  constructor(device, client) {
    super(device, 'state', {
      type: 'boolean',
      '@type': 'OnOffProperty',
      title: 'State',
      description: 'The state of the switch'
    });

    this.client = client;
  }

  async setValue(value) {
    console.log(value);
    super.setValue(value);
    const ain = this.device.deviceInfo.identifier;

    if (value === true) {
      await this.client.setSwitchOn(ain);
    } else {
      await this.client.setSwitchOff(ain);
    }
  }
}

class FritzDect200 extends Device {
  constructor(adapter, client, deviceInfo) {
    super(adapter, deviceInfo.identifier);
    this['@context'] = 'https://iot.mozilla.org/schemas/';
    this['@type'] = ['SmartPlug'];
    this.name = deviceInfo.name;
    this.description = deviceInfo.productname;
    this.client = client;
    this.deviceInfo = deviceInfo;
    this.switchProperty = new SwitchProperty(this, client);
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
    this.switchProperty.setCachedValue(info.switch.state === '1');
    this.notifyPropertyChanged(this.switchProperty);
  }
}

class SetTemperatureProperty extends Property {
  constructor(device, client) {
    super(device, 'state', {
      type: 'number',
      unit: 'degree celsius',
      title: 'Temperature',
      description: 'The set temperature'
    });

    this.client = client;
  }

  async setValue(value) {
    super.setValue(value);
    const ain = this.device.deviceInfo.identifier;
    await this.client.setTempTarget(ain, value);
  }
}

class FritzThermostat extends Device {
  constructor(adapter, client, deviceInfo) {
    super(adapter, deviceInfo.identifier);
    this['@context'] = 'https://iot.mozilla.org/schemas/';
    this.name = deviceInfo.name;
    this.description = deviceInfo.productname;
    this.client = client;
    this.deviceInfo = deviceInfo;
    this.setTemperatureProperty = new SetTemperatureProperty(this, client);
    // eslint-disable-next-line max-len
    this.properties.set(this.setTemperatureProperty.name, this.setTemperatureProperty);
  }

  startPolling(interval) {
    this.poll();
    this.timer = setInterval(() => {
      this.poll();
    }, interval * 1000);
  }

  async poll() {
    // eslint-disable-next-line max-len
    const setTemperature = await this.client.getTempTarget(this.deviceInfo.identifier);

    if (setTemperature !== this.setTemperatureProperty.value) {
      this.setTemperatureProperty.setCachedValue(setTemperature);
      this.notifyPropertyChanged(this.setTemperatureProperty);
    }
  }
}

class FritzAdapter extends Adapter {
  constructor(addonManager, manifest) {
    super(addonManager, FritzAdapter.name, manifest.name);
    addonManager.addAdapter(this);
    const {
      username,
      password,
      host
    } = manifest.moziot.config;

    if (!username) {
      console.warn('Please specify username in the config');
      return;
    }

    if (!password) {
      console.warn('Please specify password in the config');
      return;
    }

    const client = new Fritz(username, password, host);
    this.discover(client);
  }

  async discover(client) {
    const deviceInfos = await client.getDeviceList();

    for (const deviceInfo of deviceInfos) {
      // eslint-disable-next-line max-len
      if (deviceInfo.productname === 'FRITZ!DECT 200') {
        // eslint-disable-next-line max-len
        console.log(`Detected new ${deviceInfo.productname} with ain ${deviceInfo.identifier}`);
        const fritzDect200 = new FritzDect200(this, client, deviceInfo);
        this.handleDeviceAdded(fritzDect200);
        fritzDect200.startPolling(1);
      }
    }

    const thermostatAins = await client.getThermostatList();

    for (const thermostatAin of thermostatAins) {
      const deviceInfo = await client.getDevice(thermostatAin);
      // eslint-disable-next-line max-len
      console.log(`Detected new ${deviceInfo.productname} with ain ${deviceInfo.identifier}`);
      const fritzThermostat = new FritzThermostat(this, client, deviceInfo);
      this.handleDeviceAdded(fritzThermostat);
      fritzThermostat.startPolling(1);
    }
  }
}

module.exports = FritzAdapter;
