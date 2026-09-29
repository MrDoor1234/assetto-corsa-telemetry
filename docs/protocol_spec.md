# Assetto Corsa UDP Remote Telemetry Protocol Specification

## 1. Overview
Assetto Corsa streams real-time telemetry over UDP using a structured client-server request/response model. Unlike games that simply broadcast packets blindly, Assetto Corsa requires a two-way handshake to establish a subscription.

* **Default Port:** `9996` (configurable in `cfg/telemetry.ini`)
* **Transport:** UDP IPv4
* **Endianness:** Little-Endian (`<`)
* **Struct Packing:** `#pragma pack(push, 1)` (no internal byte padding)

---

## 2. Handshake Protocol

Clients communicate with the Assetto Corsa telemetry engine using a 12-byte request struct:

```c
struct HandshakePacket {
    int32_t identifier;    // Client ID (e.g. 1)
    int32_t version;       // Protocol version (1)
    int32_t operationId;   // Action requested
};
```

### Operation IDs
| Operation ID | Name | Description |
| :--- | :--- | :--- |
| `0` | `HANDSHAKE` | Queries session, driver, car, and track info. |
| `1` | `SUBSCRIBE_UPDATE` | Subscribes client to continuous `RTCarInfo` telemetry stream (~60 Hz). |
| `2` | `SUBSCRIBE_SPOT` | Subscribes client to position / spot events. |
| `3` | `DISMISS` | Unsubscribes client from telemetry stream. |

---

## 3. Telemetry Stream: `RTCarInfo` Struct (328 Bytes)

When subscribed via `operationId = 1`, the game streams the `RTCarInfo` binary packet at the physics simulation rate (typically 60 Hz).

### Binary Layout & Offsets

| Offset (Bytes) | Field Name | C Type | Python Struct | Description |
| :--- | :--- | :--- | :--- | :--- |
| `0..3` | `identifier` | `char[4]` | `4s` | Packet header (typically `'a'` or `'%'`) |
| `4..7` | `size` | `uint32_t` | `I` | Size of packet payload (328 bytes) |
| `8..11` | `speedKmh` | `float` | `f` | Vehicle speed in km/h |
| `12..15` | `speedMph` | `float` | `f` | Vehicle speed in mph |
| `16..19` | `speedMs` | `float` | `f` | Vehicle speed in m/s |
| `20` | `isAbsEnabled` | `uint8_t` | `B` | ABS active on car |
| `21` | `isAbsInAction` | `uint8_t` | `B` | ABS currently engaging |
| `22` | `isTcInAction` | `uint8_t` | `B` | Traction control currently engaging |
| `23` | `isTcEnabled` | `uint8_t` | `B` | Traction control active on car |
| `24` | `isInPit` | `uint8_t` | `B` | Car is in pit lane |
| `25` | `isEngineLimiterOn` | `uint8_t` | `B` | Engine rev limiter engaged |
| `26` | `unknownByteA` | `uint8_t` | `B` | Reserved flag |
| `27` | `unknownByteB` | `uint8_t` | `B` | Reserved flag |
| `28..31` | `heave` | `float` | `f` | Vertical G-force |
| `32..35` | `sway` | `float` | `f` | Horizontal (lateral) G-force |
| `36..39` | `surge` | `float` | `f` | Longitudinal (acceleration/braking) G-force |
| `40..43` | `lapTime` | `uint32_t` | `I` | Current lap time (ms) |
| `44..47` | `lastLap` | `uint32_t` | `I` | Previous lap time (ms) |
| `48..51` | `bestLap` | `uint32_t` | `I` | Fastest session lap time (ms) |
| `52..55` | `lapCount` | `uint32_t` | `I` | Total completed laps |
| `56..59` | `throttle` | `float` | `f` | Throttle input (0.0 to 1.0) |
| `60..63` | `brake` | `float` | `f` | Brake input (0.0 to 1.0) |
| `64..67` | `clutch` | `float` | `f` | Clutch input (0.0 to 1.0) |
| `68..71` | `engineRPM` | `float` | `f` | Engine RPM |
| `72..75` | `steer` | `float` | `f` | Steering angle (-1.0 to 1.0 or degrees) |
| `76..79` | `gear` | `uint32_t` | `I` | Gear (0 = Reverse, 1 = Neutral, 2 = 1st, 3 = 2nd...) |
| `80..83` | `cgHeight` | `float` | `f` | Center of gravity height (meters) |
| `84..99` | `wheelAngularSpeed[4]` | `float[4]` | `4f` | Angular velocity (FL, FR, RL, RR) in rad/s or RPM |
| `100..115` | `slipAngle[4]` | `float[4]` | `4f` | Slip angle for each tyre |
| `116..131` | `slipAngleContactPatch[4]`| `float[4]` | `4f` | Contact patch slip angle |
| `132..147` | `slipRatio[4]` | `float[4]` | `4f` | Slip ratio for each tyre |
| `148..163` | `tyreSlip[4]` | `float[4]` | `4f` | Dynamic tyre slip |
| `164..179` | `ndSlip[4]` | `float[4]` | `4f` | Normalized dynamic slip |
| `180..195` | `verticalLoad[4]` | `float[4]` | `4f` | Vertical load (N) on all 4 tyres |
| `196..211` | `lateralLoad[4]` | `float[4]` | `4f` | Lateral load (N) on all 4 tyres |
| `212..227` | `selfAligningTorque[4]` | `float[4]` | `4f` | Self-aligning torque (Nm) |
| `228..243` | `tyreDirtyLevel[4]` | `float[4]` | `4f` | Dirt level on tyres (0.0 - 5.0) |
| `244..259` | `camber[4]` | `float[4]` | `4f` | Camber angle (radians) |
| `260..275` | `tyreRadius[4]` | `float[4]` | `4f` | Unloaded tyre radius (meters) |
| `276..291` | `tyreLoadedRadius[4]` | `float[4]` | `4f` | Loaded tyre radius under compression |
| `292..307` | `suspensionHeight[4]` | `float[4]` | `4f` | Suspension travel/height (meters) |
| `308..311` | `carPositionNormalized` | `float` | `f` | Lap progression (0.0 to 1.0) |
| `312..315` | `carSlope` | `float` | `f` | Slope of car relative to track |
| `316..327` | `carCoordinates[3]` | `float[3]` | `3f` | World X, Y, Z coordinates |

**Total Payload Size:** 328 Bytes.
