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

class FritzDect200 extends Device {
  constructor(adapter, client, device) {
    super(adapter, device.identifier);
    this['@context'] = 'https://iot.mozilla.org/schemas/';
    this['@type'] = ['SmartPlug'];
    this.name = device.name;
    this.description = device.productname;
    this.client = client;
    this.device = device;

    this.addProperty({
      type: 'boolean',
      '@type': 'OnOffProperty',
      title: 'State',
      description: 'The state of the switch',
      readonly: true
    });
  }

  addProperty(description) {
    const property = new Property(this, description.title, description);
    this.properties.set(description.title, property);
  }

  startPolling(interval) {
    this.poll();
    this.timer = setInterval(() => {
      this.poll();
    }, interval * 1000);
  }

  async poll() {
    const device = await this.client.getDevice(this.device.identifier);
    this.updateValue('State', device.switch.state === '1');
  }

  updateValue(name, value) {
    const property = this.properties.get(name);
    property.setCachedValue(value);
    this.notifyPropertyChanged(property);
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
    const devices = await client.getDeviceList();

    for (const device of devices) {
      // eslint-disable-next-line max-len
      if (device.productname === 'FRITZ!DECT 200') {
        // eslint-disable-next-line max-len
        console.log(`Detected new ${device.productname} with ain ${device.identifier}`);
        // eslint-disable-next-line max-len
        const fritzDect200 = new FritzDect200(this, client, device);
        this.handleDeviceAdded(fritzDect200);
        fritzDect200.startPolling(1);
      }
    }
  }
}

module.exports = FritzAdapter;
