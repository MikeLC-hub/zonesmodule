/**
 * GEOMETRY ENGINE SYSTEM (UNIFIED)
 * Orchestrator: MinecraftZone
 * Data Structures: Vector (Instanced Coord3D), ZoneAxial (Segments)
 * Includes: Face Mapping, Corner Selection, and Config Merging.
 */

/** 1. SPATIAL ENUMERATORS & CONSTANTS */

const enum VECTOR { Base, Origin, Terminal, Anchor, Delta };

const VECTORS: { [vector_key: number]: string } = {
    [VECTOR.Base]: 'base',
    [VECTOR.Origin]: 'origin',
    [VECTOR.Terminal]: 'terminal',
    [VECTOR.Anchor]: 'anchor',
    [VECTOR.Delta]: 'delta'
};
type VectorType = typeof VECTORS[keyof typeof VECTORS];

/** 2. INTERFACES & CONFIGURATIONS */

/** Coord3D: Generic 3D Data structure using standard x,y,z primitives. */
type Coord3D = {
    x: number;
    y: number;
    z: number;
    _key?: VECTOR;
    _type?: VectorType;
    // Anchor specific fields (Optional on base type to allow type guarding)
    xa?: number;
    ya?: number;
    za?: number;
}
interface AnchorConfig {
    xa?: number;
    ya?: number;
    za?: number;
}

const enum DELTA_X { Left = VECTOR.Origin, Right = VECTOR.Terminal }
const enum DELTA_Y { Bottom = VECTOR.Origin, Top = VECTOR.Terminal }
const enum DELTA_Z { Front = VECTOR.Origin, Back = VECTOR.Terminal }

interface Space {
    Origin: Vector;
    Terminal: Vector;
    Name?: string;
}
type Zone = {
    Name: string;
    Anchor: Vector;
    X: ZoneAxial;
    Y: ZoneAxial;
    Z: ZoneAxial;
    Origin?: Vector;
    Terminal?: Vector;
}
type SegmentInfo = {
    count: number;
    interval: number;
    blocks: number;
}
interface SegmentConfig {
    count?: number;
    interval?: number;
    blocks?: number;
}
interface CornerSelector {
    zone_x: DELTA_X;
    zone_y: DELTA_Y;
    zone_z: DELTA_Z;
}

const enum FACE { Left, Right, Bottom, Top, Front, Back }
interface ZoneFace {
    name: string;
    abscissa_select: Axis;
    ordinate_select: Axis;
    origin_select: CornerSelector;
    terminal_select: CornerSelector;
    grid_config: AnchorConfig;
}

const enum PATTERN { Solid, Grid }
type ZonePatterns = {
    Solid: Zone;
    Grid: Zone[];
};

/**
 * 3. THE VECTOR LAYER (Logic-enabled Coord3D)
 */
class Vector implements Coord3D {
    public static toString(coord: Coord3D): string {
        const str_arr: string[] = []
        if (coord._key) str_arr.push("key: " + coord._key);
        if (coord._type) str_arr.push("type: " + coord._type);
        str_arr.push("x: " + coord.x);
        str_arr.push("y: " + coord.y);
        str_arr.push("z: " + coord.z);
        if (coord.xa) str_arr.push("xa: " + coord.xa)
        if (coord.ya) str_arr.push("ya: " + coord.ya)
        if (coord.za) str_arr.push("za: " + coord.za)
        return "{ " + str_arr.join(", ") + " }"
    }

    static fromPosition(pos0: Position): Vector {
        const world_pos = pos0.toWorld();
        return new Vector({
            x: world_pos.getValue(Axis.X),
            y: world_pos.getValue(Axis.Y),
            z: world_pos.getValue(Axis.Z),
            _key: VECTOR.Base
        });
    }

    static toSpace(coord0: Coord3D, coord1: Coord3D): Space {
        return {
            Origin: new Vector({
                x: Math.min(coord0.x, coord1.x),
                y: Math.min(coord0.y, coord1.y),
                z: Math.min(coord0.z, coord1.z),
                _key: VECTOR.Origin
            }),
            Terminal: new Vector({
                x: Math.max(coord0.x, coord1.x),
                y: Math.max(coord0.y, coord1.y),
                z: Math.max(coord0.z, coord1.z),
                _key: VECTOR.Terminal
            })
        };
    }

    static toDelta(coord0: Coord3D, coord1: Coord3D): Vector {
        return new Vector({
            x: Math.abs(coord1.x - coord0.x) + 1,
            y: Math.abs(coord1.y - coord0.y) + 1,
            z: Math.abs(coord1.z - coord0.z) + 1,
            _key: VECTOR.Delta
        });
    }
    public static toAnchor(coord: Coord3D, config?: AnchorConfig): Vector {
        const is_terminal: boolean = (coord._type === VECTORS[VECTOR.Terminal]);
        
        const to_anchor = (scalar: number, anchor_at: number): number => {
            if (is_terminal) {
                return Math.ceil(scalar / anchor_at) * anchor_at;
            }
            return Math.floor(scalar / anchor_at) * anchor_at;
        };       
        
        let x: number = coord.x;
        let y: number = coord.y;
        let z: number = coord.z;
        if (config) {
            if (config.xa) x = to_anchor(x, config.xa);
            if (config.ya) y = to_anchor(y, config.ya);
            if (config.za) z = to_anchor(z, config.za);
        }

        const anchor = new Vector({ x: x, y: y, z: z, _key: VECTOR.Anchor });

        // Store the config used so we can debug it later
        if (config) {
            anchor.xa = config.xa;
            anchor.ya = config.ya;
            anchor.za = config.za;
        }
        return anchor;
    }

    public x: number;
    public y: number;
    public z: number;
    public _key: VECTOR;
    public _type: VectorType;

    // Config storage
    public xa?: number;
    public ya?: number;
    public za?: number;

    public constructor(coord: Coord3D) {
        this.x = coord.x;
        this.y = coord.y;
        this.z = coord.z;
        this._key = coord._key !== undefined ? coord._key : VECTOR.Base;
        // Correct lookup for MakeCode runtime
        this._type = VECTORS[this._key as number] as VectorType;

        // Pass through anchor configs if they exist
        this.xa = coord.xa;
        this.ya = coord.ya;
        this.za = coord.za;
    }
    public toAnchor(config?: AnchorConfig): Vector {
        return Vector.toAnchor(this, config)
    }
    public toString(): string {
        return Vector.toString(this)
    }
}
/**
 * 4. THE SCALAR LAYER (Axials)
 *    Class ZoneAxial 
 */
class ZoneAxial implements SegmentInfo {
    public static readonly MAX_INTERVAL = 64;

    public readonly segment: SegmentInfo = { count: 1, interval: 1, blocks: 1 };
    private _length: number;

    constructor(length: number, config?: SegmentConfig) {
        this._length = Math.max(Math.abs(length), 1);
        this.configure(config);
    };

    get length(): number { return this._length; }
    get count(): number { return this.segment.count; }
    get interval(): number { return this.segment.interval; }
    get blocks(): number { return this.segment.blocks; }

    public configure(config?: SegmentConfig): void {
        let count = Math.ceil(this._length / ZoneAxial.MAX_INTERVAL);
        let interval = Math.ceil(this._length / count);
        let blocks = interval;

        if (config) {
            if (config.count != null) {
                count = Math.max(count, config.count);
                interval = Math.ceil(this._length / count);
                blocks = interval;
            } else if (config.interval != null) {
                interval = Math.max(1, Math.min(ZoneAxial.MAX_INTERVAL, config.interval));
                count = Math.ceil(this._length / interval);
                blocks = interval;
            }
            if (config.blocks != null) {
                blocks = Math.max(1, Math.min(interval, config.blocks));
            }
        }

        this.segment.count = count;
        this.segment.interval = interval;
        this.segment.blocks = blocks;
    }

    public toString(): string {
        return "{ length: " + this._length + ", count: " + this.count + ", interval: " + this.interval + ", blocks: " + this.blocks + " }";
    }
}

/**
 * 5. THE ORCHESTRATION LAYER (MinecraftZone)
 */
class MinecraftZone implements Zone {
    public static readonly VOLUME_LIMIT: number = 32768;
    public static readonly BATCH_COUNT: number = 64;
    public static readonly GRID_AXIAL: SegmentConfig = { interval: 10, blocks: 1 };
    public static readonly TIME_QUERY: TimeQuery = GAME_TIME

    public static readonly FACE_INFO: { [key: number]: ZoneFace } = {
        [FACE.Left]: {
            name: "X - Left",
            abscissa_select: Axis.Z, ordinate_select: Axis.Y,
            origin_select: { zone_x: DELTA_X.Left, zone_y: DELTA_Y.Bottom, zone_z: DELTA_Z.Front },
            terminal_select: { zone_x: DELTA_X.Left, zone_y: DELTA_Y.Top, zone_z: DELTA_Z.Back },
            grid_config: { ya: 10, za: 10 }
        },
        [FACE.Right]: {
            name: "X + Right",
            abscissa_select: Axis.Z, ordinate_select: Axis.Y,
            origin_select: { zone_x: DELTA_X.Right, zone_y: DELTA_Y.Bottom, zone_z: DELTA_Z.Front },
            terminal_select: { zone_x: DELTA_X.Right, zone_y: DELTA_Y.Top, zone_z: DELTA_Z.Back },
            grid_config: { ya: 10, za: 10 }
        },
        [FACE.Bottom]: {
            name: "Y - Bottom",
            abscissa_select: Axis.X, ordinate_select: Axis.Z,
            origin_select: { zone_x: DELTA_X.Left, zone_y: DELTA_Y.Bottom, zone_z: DELTA_Z.Front },
            terminal_select: { zone_x: DELTA_X.Right, zone_y: DELTA_Y.Bottom, zone_z: DELTA_Z.Back },
            grid_config: { xa: 10, za: 10 }
        },
        [FACE.Top]: {
            name: "Y+ Top",
            abscissa_select: Axis.X, ordinate_select: Axis.Z,
            origin_select: { zone_x: DELTA_X.Left, zone_y: DELTA_Y.Top, zone_z: DELTA_Z.Front },
            terminal_select: { zone_x: DELTA_X.Right, zone_y: DELTA_Y.Top, zone_z: DELTA_Z.Back },
            grid_config: { xa: 10, za: 10 }
        },
        [FACE.Front]: {
            name: "Z- Front",
            abscissa_select: Axis.X, ordinate_select: Axis.Y,
            origin_select: { zone_x: DELTA_X.Left, zone_y: DELTA_Y.Bottom, zone_z: DELTA_Z.Front },
            terminal_select: { zone_x: DELTA_X.Right, zone_y: DELTA_Y.Top, zone_z: DELTA_Z.Front },
            grid_config: { xa: 10, ya: 10 }
        },
        [FACE.Back]: {
            name: "Z+ Back",
            abscissa_select: Axis.X, ordinate_select: Axis.Y,
            origin_select: { zone_x: DELTA_X.Left, zone_y: DELTA_Y.Bottom, zone_z: DELTA_Z.Back },
            terminal_select: { zone_x: DELTA_X.Right, zone_y: DELTA_Y.Top, zone_z: DELTA_Z.Back },
            grid_config: { xa: 10, ya: 10 }
        }
    };

    public static IN_PROGRESS = false;

    //% block blockNamespace="Zones"
    public static cancel():void {
        MinecraftZone.IN_PROGRESS = false
    }

    public static fromPositions(pos0: Position, pos1: Position, name?: string): MinecraftZone {
        const space = Vector.toSpace(Vector.fromPosition(pos0), Vector.fromPosition(pos1));
        if (name) space.Name = name;
        return new MinecraftZone(space);
    }

    public static baseZone(name: string, anchor: Vector, delta: Vector): Zone {
        const x = new ZoneAxial(delta.x);
        const y = new ZoneAxial(delta.y);
        const z = new ZoneAxial(delta.z);
        return { Name: name, Anchor: anchor, X: x, Y: y, Z: z };
    }

    public static configureAxial(zone: Zone, axial: Axis, segment_config: SegmentConfig): void {
        let axial_ref: ZoneAxial;
        if (axial === Axis.X) axial_ref = zone.X;
        else if (axial === Axis.Y) axial_ref = zone.Y;
        else if (axial === Axis.Z) axial_ref = zone.Z;
        else return;

        axial_ref.configure(segment_config);
        MinecraftZone._applyVolumeLimit(zone);
    }

    public static toString(zone: Zone): string {
        const str_arr: string[] = []
        str_arr.push("Name: " + zone.Name)
        if (zone.Origin) str_arr.push("Origin: " + zone.Origin.toString())
        if (zone.Terminal) str_arr.push("Terminal: " + zone.Terminal.toString())
        str_arr.push("Anchor: " + zone.Anchor.toString())
        str_arr.push("X: " + zone.X.toString())
        str_arr.push("Y: " + zone.Y.toString())
        str_arr.push("Z: " + zone.Z.toString())
        return "{ \n" + str_arr.join("\n") + "\n }"
    }

    private static _applyVolumeLimit(zone: Zone): void {
        const area = zone.X.interval * zone.Z.interval;
        const y_max = Math.floor(MinecraftZone.VOLUME_LIMIT / area);
        const y_interval = Math.min(zone.Y.interval, y_max);
        zone.Y.configure({ interval: y_interval });
    }

    protected _name: string;
    protected _origin: Vector;
    protected _terminal: Vector;
    protected _anchor: Vector;
    protected _x: ZoneAxial;
    protected _y: ZoneAxial;
    protected _z: ZoneAxial;

    private constructor(space: Space) {
        this._name = space.Name || "MyZone";
        this._origin = space.Origin;
        this._terminal = space.Terminal;
        this.calibrate();
    }

    public get Name():    string { return this._name; };
    public get Origin():   Vector { return this._origin; };
    public get Terminal(): Vector { return this._terminal; };
    public get Anchor():   Vector { return this._anchor; };

    public get X(): ZoneAxial { return this._x; };
    public get Y(): ZoneAxial { return this._y; };
    public get Z(): ZoneAxial { return this._z; };

    public calibrate(): void {
        const space = Vector.toSpace(this._origin, this._terminal);
        this._origin = space.Origin;
        this._terminal = space.Terminal;

        // Establish the world-locked anchor
        this._anchor = Vector.toAnchor(this._origin);

        const delta = Vector.toDelta(this._origin, this._terminal);
        this._x = new ZoneAxial(delta.x);
        this._y = new ZoneAxial(delta.y);
        this._z = new ZoneAxial(delta.z);

        MinecraftZone._applyVolumeLimit(this);
    }

    public getZoneCorner(corner: CornerSelector, outside?: boolean): Coord3D {
        const offset = outside ? 1 : 0;
        return {
            x: (corner.zone_x === DELTA_X.Left) ? this._origin.x - offset : this._terminal.x + offset,
            y: (corner.zone_y === DELTA_Y.Bottom) ? this._origin.y - offset : this._terminal.y + offset,
            z: (corner.zone_z === DELTA_Z.Front) ? this._origin.z - offset : this._terminal.z + offset
        };
    }

    public getFaceZones(face: FACE, outside?: boolean): ZonePatterns {
        const face_info = MinecraftZone.FACE_INFO[face as number];
        if (!face_info) return null
        const grid_config: AnchorConfig = face_info.grid_config;
        const origin_coord: Coord3D = this.getZoneCorner(face_info.origin_select, outside);
        const terminal_coord: Coord3D = this.getZoneCorner(face_info.terminal_select, outside);
        const zone_space: Space = Vector.toSpace(origin_coord, terminal_coord)

        const origin_anchor: Vector = zone_space.Origin.toAnchor(grid_config);
        const terminal_anchor: Vector = zone_space.Terminal.toAnchor(grid_config);
        const zone_delta = Vector.toDelta(origin_anchor, terminal_anchor);

        const basePatternZone = (suffix: string): Zone => (
            MinecraftZone.baseZone(this._name + "_" + suffix, origin_anchor, zone_delta)
        );

        const Solid: Zone = basePatternZone("Solid");

        const Abscissa: Zone = basePatternZone("Abscissa");
        MinecraftZone.configureAxial(Abscissa, face_info.abscissa_select, MinecraftZone.GRID_AXIAL);

        const Ordinate: Zone = basePatternZone("Ordinate");
        MinecraftZone.configureAxial(Ordinate, face_info.ordinate_select, MinecraftZone.GRID_AXIAL);

        return { Solid: Solid, Grid: [Abscissa, Ordinate] };
    }

    public static zone(zone: Zone, handler: (name: string, origin: Position, terminal: Position) => void): void {
        if (MinecraftZone.IN_PROGRESS) return;
        const BATCH_COUNT: number = MinecraftZone.BATCH_COUNT;
        const TIME_QUERY: TimeQuery = MinecraftZone.TIME_QUERY;
        const CurrentTime = () => {
            return gameplay.timeQuery(TIME_QUERY);
        };

        const zone_name: string = zone.Name;
        const sub_name: string = zone_name + "_";

        const anchor_x: number = zone.Anchor.x;
        const anchor_y: number = zone.Anchor.y;
        const anchor_z: number = zone.Anchor.z;

        const x_count: number = zone.X.count;
        const y_count: number = zone.Y.count;
        const z_count: number = zone.Z.count;

        const x_interval: number = zone.X.interval;
        const y_interval: number = zone.Y.interval;
        const z_interval: number = zone.Z.interval;

        const net_x_blocks: number = zone.X.blocks - 1;
        const net_y_blocks: number = zone.Y.blocks - 1;
        const net_z_blocks: number = zone.Z.blocks - 1;

        const TOTAL_COUNT: number = x_count * y_count * z_count;

        let IN_PROGRESS: boolean = true; MinecraftZone.IN_PROGRESS = IN_PROGRESS;

        const START_TIME: number = CurrentTime();

        const ExecuteCmd = (cmd_str: string) => {
            player.execute(cmd_str)
        };
        const UpdateProgress = (zone_index: number) => {
            const cmd_str: string = MinecraftZone._getDisplayCmdStr(zone_name, zone_index, TOTAL_COUNT, START_TIME, CurrentTime(), IN_PROGRESS);
            ExecuteCmd(cmd_str)
        };
        const ReportResult = () => {
            const completion_time: number = ((CurrentTime() - START_TIME) / 20);
            const minutes: number = (completion_time / 60) | 0;
            const seconds: number = (completion_time % 60) | 0;
            const time_string: string = "" + minutes + "m" + seconds + "s";
            player.say("Completion Count: " + TOTAL_COUNT + ", Time: " + time_string);
            const cmd_str = "titleraw @s actionbar {\"rawtext\":[{\"text\":\"§a✔ Finished " + zone.Name + " in " + time_string + "\"}]}";
            ExecuteCmd(cmd_str);
        }
        const CleanUp = () => {
            IN_PROGRESS = false
            MinecraftZone.IN_PROGRESS = IN_PROGRESS;
        };

        let zone_index = 0;
        // X Loop
        for (let dx = 0; dx < x_count; dx++) {
            const ox = anchor_x + (dx * x_interval);
            const tx = ox + net_x_blocks;

            // SNAKE LOGIC: If dx is odd, reverse the Z direction
            const is_forward = (dx % 2 === 0);

            // Z Loop
            for (let i = 0; i < z_count; i++) {
                // Calculate dz based on snake direction to keep ticking bridge connected
                const dz = is_forward ? i : (z_count - 1 - i);

                const oz = anchor_z + (dz * z_interval);
                const tz = oz + net_z_blocks;

                UpdateProgress(zone_index);
                // Y Loop (The innermost workhorse)
                for (let dy = 0; dy < y_count; dy++) {
                    if (!IN_PROGRESS) {
                        CleanUp();
                        return;
                    }
                    
                    if (zone_index % 64) loops.pause(1);
                    const oy = anchor_y + (dy * y_interval);
                    const ty = oy + net_y_blocks;

                    const name: string = sub_name + zone_index
                    const origin: Position = world(ox, oy, oz);
                    const terminal: Position = world(tx, ty, tz);
                    handler(name, origin, terminal);
                    zone_index++;
                }
            }
        } 
        ReportResult();
        CleanUp();
    }

    private static _getDisplayCmdStr(display_name: string, current_index: number, total_count: number, start_time: number, current_time: number, in_progress: boolean): string {
        const percentage:   number = ((current_index * 100) / total_count) | 0;
        const elapsed_time: number = current_time - start_time;
        const eta_in_sec:   number = current_index > 0 ? (((elapsed_time) * (total_count - current_index) / current_index)/20) | 0 : 0;
        const bar_width:    number = 20;
        const bar_filled:   number = ((percentage * bar_width) / 100) | 0;
        
        let progress_bar: string = "[";
        for (let i = 0; i < bar_width; i++) progress_bar += i < bar_filled ? "+" : "-";
        progress_bar += `] ${percentage}%`;

        const cmd_str: string = "titleraw @s actionbar {\"rawtext\":[{\"text\":\"§eZone: " + display_name + " " + progress_bar + " | §fETA: " + Math.floor(eta_in_sec / 60) + "m " + (eta_in_sec % 60) + "s\"}]}";
        return cmd_str;
    }

    public toString(): string {
        return MinecraftZone.toString(zone);
    }
}

/** 6. NAMESPACE EXPORTS */

//% weight=500 color=#311E38
namespace Zones {

    //% block="space|$pos0=minecraftCreateWorldPosition|$pos1=minecraftCreateWorldPosition||name:$name"
    //% blockSetVariable="zone"
    export function space(pos0: Position, pos1: Position, name?: string): MinecraftZone {
        return MinecraftZone.fromPositions(pos0, pos1, name);
    }

    //% block
    //% zone.shadow=variables_get zone.defl="zone"
    //% handlerStatement
    //% draggableParameters="reporter, reporter, reporter"
    export function zone(zone: Zone, handler: (name: string, origin: Position, terminal: Position) => void): void {
        MinecraftZone.zone(zone, handler);
    }

    //% block="pattern|$zone|face:|$face|pattern:|$pattern||outside:$outside|blocks:|$block_list"
    //% inlineInputMode=inline
    //% zone.shadow=variables_get zone.defl="zone"
    export function zoningFacePattern(zone: MinecraftZone, face: FACE, pattern: PATTERN, outside?: boolean, block_list?: Block[]): void {
        const face_zones: ZonePatterns = zone.getFaceZones(face, outside);
        if (!face_zones) return;
		
        let zones: Zone[] = [];
		let default_blocks: Block[] = [];
        switch (pattern) {
            case PATTERN.Solid: zones = [face_zones.Solid]; default_blocks = [BLACK_CONCRETE]; break;
            case PATTERN.Grid: zones  = face_zones.Grid;    default_blocks = [PEARLESCENT_FROGLIGHT, VERDANT_FROGLIGHT]; break;
            default: return;
        };
        const fill_blocks: number[] = (block_list && block_list.length > 0) ? block_list : default_blocks;
        const fill_blocks_length: number = fill_blocks.length;
        
        let block_index: number = 0;
        for (let local_zone of zones) {
            const block: number = fill_blocks[block_index];
            MinecraftZone.zone(local_zone, function (name, origin, terminal) {
                blocks.fill(block, origin, terminal, FillOperation.Replace);
            });
            block_index++;
            if (block_index >= fill_blocks_length) block_index = 0;
        }
    }

    //% block="$zone|to string"
    //% zone.shadow=variables_get zone.defl="zone"
    export function zoneToString(zone: Zone): string {
        if ((zone as any).toString) {
            return (zone as any).toString();
        }
        return zone.Name;
    }
}