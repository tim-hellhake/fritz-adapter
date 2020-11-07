const fetchMock = require('jest-fetch-mock');

fetchMock.enableMocks();

beforeEach(() => {
    fetch.resetMocks();
});

const { readFileSync } = require('fs');

const xml = readFileSync('./test.xml');

const { FritzClient } = require('../lib/fritz-client');

const host = 'http://test.host'
const sid = 'foo'

it('should parse the device descriptions correctly', async () => {
    fetch.mockResponseOnce(xml);

    const fritzClient = new FritzClient(host, sid);
    const deviceInfos = await fritzClient.getDeviceInfos();
    const button = deviceInfos.filter(x => x.identifier == '099950756387')[0];

    expect(button.name).toEqual('Schalter 1');
    expect(button.productname).toEqual('FRITZ!DECT 440');

    expect(button.buttons.length).toEqual(4);

    expect(button.buttons[0].id).toEqual('5000');
    expect(button.buttons[0].name).toEqual('Schalter 1: Top right');
    expect(button.buttons[0].lastpressedtimestamp).toEqual(1604710638);

    expect(button.buttons[1].id).toEqual('5001');
    expect(button.buttons[1].name).toEqual('Schalter 1: Bottom right');
    expect(button.buttons[1].lastpressedtimestamp).toEqual(1602355181);

    expect(button.buttons[2].id).toEqual('5002');
    expect(button.buttons[2].name).toEqual('Schalter 1: Bottom left');
    expect(button.buttons[2].lastpressedtimestamp).toEqual(1602355178);

    expect(button.buttons[3].id).toEqual('5003');
    expect(button.buttons[3].name).toEqual('Schalter 1: Top left');
    expect(button.buttons[3].lastpressedtimestamp).toEqual(1604598916);

    expect(fetch).toHaveBeenCalledTimes(1);
});

it('should emit button presses', async () => {
    fetch.mockResponseOnce(xml);

    const fritzClient = new FritzClient(host, sid);
    const buttons = await fritzClient.getButtons();
    const button = buttons.filter(x => x.getAin() == '099950756387')[0];

    fetch.mockResponseOnce(xml.toString().replace('1602355178', '1602355179'));

    const callback = jest.fn();

    button.on('press', buttonId => callback(buttonId));

    await fritzClient.update();

    expect(callback).toBeCalledTimes(1);
    expect(callback).toBeCalledWith('5002');
});
