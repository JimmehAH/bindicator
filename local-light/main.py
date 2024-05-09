# © 2024 James Hannett
# Based on example code from Pimoroni
# https://github.com/pimoroni/pimoroni-pico/tree/main/micropython/examples/plasma_stick

import WIFI_CONFIG
import SECRETS

from network_manager import NetworkManager
import uasyncio
import urequests
import time
import ntptime
import plasma
from plasma import plasma_stick
from machine import Pin

URL = "https://bindicator.hannett.dev/auth/next-collection"
UPDATE_INTERVAL = 20 + (0 * 60) + (0 * 3600)  # seconds + (minutes) + (hours)

# Set how many LEDs you have
NUM_LEDS = 50


def status_handler(mode, status, ip):
    # reports wifi connection status
    print(mode, status, ip)
    print("Connecting to wifi...")
    # flash while connecting
    for i in range(NUM_LEDS):
        led_strip.set_rgb(i, 255, 255, 255)
        time.sleep(0.02)
    for i in range(NUM_LEDS):
        led_strip.set_rgb(i, 0, 0, 0)
    if status is not None:
        if status:
            print("Wifi connection successful!")
        else:
            print("Wifi connection failed!")
            # if no wifi connection, you get spooky rainbows. Bwahahaha!
            spooky_rainbows()


def spooky_rainbows():
    print("SPOOKY RAINBOWS!")
    HUE_START = 30  # orange
    HUE_END = 140  # green
    SPEED = 0.3  # bigger = faster (harder, stronger)

    distance = 0.0
    direction = SPEED
    while True:
        for i in range(NUM_LEDS):
            # generate a triangle wave that moves up and down the LEDs
            j = max(0, 1 - abs(distance - i) / (NUM_LEDS / 3))
            hue = HUE_START + j * (HUE_END - HUE_START)

            led_strip.set_hsv(i, hue / 360, 1.0, 0.8)

        # reverse direction at the end of colour segment to avoid an abrupt change
        distance += direction
        if distance > NUM_LEDS:
            direction = -SPEED
        if distance < 0:
            direction = SPEED

        time.sleep(0.01)


def mktime_from_mp_time(mp_time):
    return time.mktime(
        (
            mp_time["year"],
            mp_time["month"],
            mp_time["mday"],
            mp_time["hour"],
            mp_time["minute"],
            mp_time["second"],
            mp_time["weekday"],
            mp_time["yearday"],
        )
    )


# set up the Pico W's onboard LED
pico_led = Pin("LED", Pin.OUT)

# set up the WS2812 / NeoPixel™ LEDs
led_strip = plasma.WS2812(
    NUM_LEDS, 0, 0, plasma_stick.DAT, color_order=plasma.COLOR_ORDER_RGB
)

# start updating the LED strip
led_strip.start()

# set up wifi
try:
    network_manager = NetworkManager(WIFI_CONFIG.COUNTRY, status_handler=status_handler)
    uasyncio.get_event_loop().run_until_complete(
        network_manager.client(WIFI_CONFIG.SSID, WIFI_CONFIG.PSK)
    )
except Exception as e:
    print(f"Wifi connection failed! {e}")
    # if no wifi, then you get...
    spooky_rainbows()

# Having the correct time is important for this to work
print("Setting time via NTP...")
ntptime.settime()

while True:
    # open the json file
    print(f"Requesting URL: {URL}")
    r = urequests.get(URL, headers={"Authorization": f"Basic {SECRETS.URL_AUTH_TOKEN}"})

    print(r.text)

    # open the json data
    collection_data = r.json()
    print("Data obtained!")
    r.close()

    # get the data about the next collection
    collections = collection_data["collections"]

    # flash the onboard LED after getting data
    pico_led.value(True)
    time.sleep(0.2)
    pico_led.value(False)

    if "mp_end_date" not in collection_data:
        print("No stop time specified so setting a default")
        stop_date = time.time() + UPDATE_INTERVAL
    else:
        stop_date = mktime_from_mp_time(collection_data["mp_end_date"])

    if "mp_start_date" not in collection_data:
        print("No start time specified so setting a default")
        start_date = time.time()
    else:
        start_date = mktime_from_mp_time(collection_data["mp_start_date"])

    print(start_date)
    print(stop_date)
    print(time.time())

    print(f"Current time is {time.gmtime()}")
    print(f"Getting a new file at {time.gmtime(start_date)}")

    while time.time() < stop_date:

        if time.time() > start_date:
            for collecton in collections:
                # pull out the RBG
                r, g, b = collecton["colour"]["rgb"]

                print(f"Collection: {collecton}")

                # light up the LEDs
                for i in range(NUM_LEDS):
                    led_strip.set_rgb(i, r, g, b)
                print(f"LEDs set to {collecton['colour']['rgb']}")

                time.sleep(2)

    time.sleep(UPDATE_INTERVAL)
