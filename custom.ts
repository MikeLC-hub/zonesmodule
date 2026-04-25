/**
 * GEOMETRY ENGINE SYSTEM (UNIFIED)
 * Orchestrator: MinecraftZone
 * Data Structures: Vector (Instanced Coord3D), ZoneAxial (Segments)
 * Includes: Face Mapping, Corner Selection, and Config Merging.
 */

/** 1. SPATIAL ENUMERATORS & CONSTANTS */
const CMD_JOIN: string = " ";
const enum VECTOR { Base, Origin, Terminal, Anchor, Delta };
const enum SECTORCONFIG {
    config_0,
    config_1,
    config_2,
    config_3,
    config_4,
}

const enum DIRECTION {
    North, South, West, East
};

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

interface CoordXZ {
    readonly x: number;
    readonly z: number;
};

/** 1. THE CHUNK LAYER */

type ChunkID = {
    readonly cX: number;
    readonly cZ: number;
};

interface Chunk extends ChunkID {
    toCoord(): Coord3D;
    toWorld(): Position;
    toString(): string;
};

interface LengthConfig {
    lX: number;
    lZ: number;
};

interface ConfigEvaluation {
    config: LengthConfig;
    remaining: number;
}

interface SectorInfo {
    origin: ChunkID;
    config: LengthConfig;
};

interface Sector extends SectorInfo {
    readonly ID: string;
    index: number;
    is_active: boolean;
    contains(chunk: Chunk): boolean;
};
class MinecraftChunk implements Chunk {
    public static readonly XZ_LENGTH: number = 16;
    public static readonly CLASS_STRING: string = "chunk";

    public static getChunkID(x: number, z: number): ChunkID {
        const cX: number = (x | 0) >> 4;
        const cZ: number = (z | 0) >> 4;
        return { cX, cZ } as ChunkID;
    }

    private static _determineCoordXZ(cX: number, cZ: number): CoordXZ {
        const x: number = (cX | 0) << 4;
        const z: number = (cZ | 0) << 4;
        return { x, z } as CoordXZ;
    }

    private static _is(chunk0: ChunkID, chunk1: ChunkID): boolean {
        return (chunk0.cX === chunk1.cX && chunk0.cZ === chunk1.cZ);
    };

    private static _containsCoord(chunk: ChunkID, query: CoordXZ): boolean {
        const query_chunk: ChunkID = MinecraftChunk.getChunkID(query.x, query.z);
        return MinecraftChunk._is(chunk, query_chunk);
    }

    public static getOffsetChunkID(chunk: ChunkID, config: LengthConfig): ChunkID {
        return {
            cX: (chunk.cX + config.lX - 1) | 0,
            cZ: (chunk.cZ + config.lZ - 1) | 0
        } as ChunkID;
    }

    public static getCoordChunkID(coord: CoordXZ | Coord3D): ChunkID {
        return MinecraftChunk.getChunkID(coord.x, coord.z);
    }

    public static getWorldChunkID(pos0: Position): ChunkID {
        const world_pos: Position = pos0.toWorld();
        return MinecraftChunk.getChunkID(
            world_pos.getValue(Axis.X),
            world_pos.getValue(Axis.Z)
        );
    }

    public static getStringChunkID(str: string): ChunkID {
        let cX: number = 0;
        let cZ: number = 0;
        const unstrung: string[] = str.split("_");
        if (unstrung.length === 3 && unstrung[0] === MinecraftChunk.CLASS_STRING) {
            cX = parseInt(unstrung[1].replace("cX", ""));
            cZ = parseInt(unstrung[2].replace("cZ", ""));
        }
        return { cX, cZ };
    }

    public static offsetChunk(chunk: ChunkID, config: LengthConfig): MinecraftChunk {
        const offset_id: ChunkID = MinecraftChunk.getOffsetChunkID(chunk, config);
        return new MinecraftChunk(offset_id);
    }

    public static fromWorld(pos0: Position): MinecraftChunk {
        const world_id: ChunkID = MinecraftChunk.getWorldChunkID(pos0);
        return new MinecraftChunk(world_id);
    }

    public static fromCoord(coord: CoordXZ | Coord3D): MinecraftChunk {
        const coord_id: ChunkID = MinecraftChunk.getCoordChunkID(coord);
        return new MinecraftChunk(coord_id);
    }

    public static fromString(chunk_str: string): MinecraftChunk | null {
        const string_id: ChunkID = MinecraftChunk.getStringChunkID(chunk_str);
        if (string_id.cX !== undefined && string_id.cZ !== undefined) return new MinecraftChunk(string_id);
        return null;
    }

    public static toWorld(chunk: ChunkID): Position {
        const blocks = MinecraftChunk._determineCoordXZ(chunk.cX, chunk.cZ);
        return world(blocks.x, 0, blocks.z);
    }

    public static toCoord(chunk: ChunkID): Coord3D {
        const blocks = MinecraftChunk._determineCoordXZ(chunk.cX, chunk.cZ);
        return { x: blocks.x, y: 0, z: blocks.z };
    }

    public static toString(chunk: ChunkID): string {
        return MinecraftChunk.CLASS_STRING + "_cX" + chunk.cX + "_cZ" + chunk.cZ;
    }

    public readonly cX: number;
    public readonly cZ: number;

    public constructor(info: ChunkID) {
        this.cX = info.cX | 0;
        this.cZ = info.cZ | 0;
    }

    public is(query: ChunkID): boolean { return MinecraftChunk._is(this, query) };
    public contains(query: CoordXZ): boolean { return MinecraftChunk._containsCoord(this, query); };
    public offset(config: LengthConfig): MinecraftChunk { return MinecraftChunk.offsetChunk(this, config); };
    public toWorld(): Position { return MinecraftChunk.toWorld(this); };
    public toCoord(): Coord3D { return MinecraftChunk.toCoord(this); };
    public toString(): string { return MinecraftChunk.toString(this); };
}

class TickingSector implements Sector {
    public static readonly MAX_ACTIVE_SECTORS: number = 10;
    public static readonly MAX_SECTOR_CHUNKS: number = 100;

    public static readonly CONFIGURATION: { [key: number]: LengthConfig } = {
        [SECTORCONFIG.config_0]: { lX: 25, lZ: 4 },
        [SECTORCONFIG.config_1]: { lX: 20, lZ: 5 },
        [SECTORCONFIG.config_2]: { lX: 10, lZ: 10 },
        [SECTORCONFIG.config_3]: { lX: 5, lZ: 20 },
        [SECTORCONFIG.config_4]: { lX: 4, lZ: 25 }
    };

    public static get CONFIG_SIZE(): number {
        return Object.keys(TickingSector.CONFIGURATION).length;
    }

    public static toSectorConfig(config: LengthConfig): LengthConfig {
        const _lX: number = config.lX;
        let sector_config: LengthConfig = TickingSector.CONFIGURATION[SECTORCONFIG.config_2];

        for (let config_index = 0; config_index < TickingSector.CONFIG_SIZE; config_index++) {
            const this_config: LengthConfig = TickingSector.CONFIGURATION[config_index];
            if (this_config.lX >= _lX) {
                sector_config = this_config;
                break;
            }
        }
        return sector_config;
    }

    private static ActiveSectors: TickingSector[] = [];
    private static SectorCount: number = 0;

    private static _updateActiveIndexes(): void {
        for (let i = 0; i < TickingSector.ActiveSectors.length; i++) {
            TickingSector.ActiveSectors[i]._index = i | 0;
        }
    }

    private static _newSectorID(): string {
        return "sector_" + TickingSector.SectorCount++;
    }

    public static toSectorInfo(chunk0: ChunkID, chunk1: ChunkID): SectorInfo {
        const origin: MinecraftChunk = new MinecraftChunk({
            cX: Math.min(chunk0.cX, chunk1.cX) | 0,
            cZ: Math.min(chunk0.cZ, chunk1.cZ) | 0
        });
        const config: LengthConfig = TickingSector.toSectorConfig({
            lX: Math.abs(chunk1.cX - chunk0.cX) + 1,
            lZ: Math.abs(chunk1.cZ - chunk0.cZ) + 1
        });
        return { origin, config };
    }

    public static getTerminal(sector: SectorInfo): Chunk {
        return MinecraftChunk.offsetChunk(sector.origin, sector.config);
    }

    public static containsChunk(sector: SectorInfo, chunk: ChunkID): boolean {
        const secX = sector.origin.cX | 0;
        const secZ = sector.origin.cZ | 0;
        const lX = sector.config.lX | 0;
        const lZ = sector.config.lZ | 0;
        const relX = (chunk.cX - secX + 1) | 0;
        const relZ = (chunk.cZ - secZ + 1) | 0;
        return (relX > 0 && relX <= lX) && (relZ > 0 && relZ <= lZ);
    }

    public static getAdjacent(sector: SectorInfo, direction: DIRECTION): SectorInfo {
        const _config: LengthConfig = sector.config;
        let cX: number = sector.origin.cX;
        let cZ: number = sector.origin.cZ;

        switch (direction) {
            case DIRECTION.North:
                cZ -= _config.lZ;
                break;
            case DIRECTION.South:
                cZ += _config.lZ;
                break;
            case DIRECTION.West:
                cX -= _config.lX;
                break;
            case DIRECTION.East:
                cX += _config.lX;
                break;
        }
        return { origin: { cX, cZ }, config: _config };
    }

    public static getActiveIndex(sector: SectorInfo): number {
        TickingSector._updateActiveIndexes();
        const target_cX = sector.origin.cX;
        const target_cZ = sector.origin.cZ;
        const target_lX = sector.config.lX;
        const target_lZ = sector.config.lZ;

        for (let active_sector of TickingSector.ActiveSectors) {
            const cX_match: boolean = (active_sector.origin.cX === target_cX);
            const cZ_match: boolean = (active_sector.origin.cZ === target_cZ);
            const lX_match: boolean = (active_sector.config.lX === target_lX);
            const lZ_match: boolean = (active_sector.config.lZ === target_lZ);

            if (cX_match && cZ_match && lX_match && lZ_match) return active_sector.index;
        }
        return -1;
    }

    public static getChunkActiveIndex(chunk: ChunkID): number {
        TickingSector._updateActiveIndexes();
        for (let active_sector of TickingSector.ActiveSectors) {
            if (active_sector.contains(chunk)) return active_sector.index;
        }
        return -1;
    }

    public static activateSector(sector: SectorInfo): void {
        const active_index: number = TickingSector.getActiveIndex(sector);
        if (active_index >= 0) return; // returns if already active.

        while (TickingSector.ActiveSectors.length >= TickingSector.MAX_ACTIVE_SECTORS) {
            const oldest = TickingSector.ActiveSectors.shift();
            if (oldest) TickingSector.removeSector(oldest);
        }

        const ticking_sector = new TickingSector(sector)

        const cmd: string[] = ["tickingarea add"];
        cmd.push(ticking_sector.origin.toWorld().toString());
        cmd.push(ticking_sector.terminal.toWorld().toString());
        cmd.push(ticking_sector.ID);

        player.execute(cmd.join(CMD_JOIN));
        TickingSector.ActiveSectors.push(ticking_sector);
        TickingSector._updateActiveIndexes();
    }

    public static removeSector(sector: SectorInfo): void {
        const idx = TickingSector.getActiveIndex(sector);
        if (idx === -1) return;

        const active_sector = TickingSector.ActiveSectors[idx]

        const cmd: string[] = ["tickingarea remove"]
        cmd.push(active_sector.ID)
        player.execute(cmd.join(CMD_JOIN));

        TickingSector.ActiveSectors.splice(idx, 1);
        active_sector._index = -1;
        TickingSector._updateActiveIndexes();
    };

    public static removeAll(): void {
        const cmd_str: string = "tickingarea remove_all";
        player.execute(cmd_str);
        for (let this_sector of TickingSector.ActiveSectors) { this_sector._index = -1; };
        TickingSector.ActiveSectors = [];
        TickingSector.SectorCount = 0;
    }

    public static ensureActiveChunk(chunk: ChunkID, config?: LengthConfig): void {
        const active_sectors: Sector[] = TickingSector.ActiveSectors;

        if (active_sectors.length === 0) {
            const sector_origin: ChunkID = chunk;
            const sector_config: LengthConfig = config ? TickingSector.toSectorConfig(config) : TickingSector.CONFIGURATION[SECTORCONFIG.config_2];
            TickingSector.activateSector({
                origin: sector_origin,
                config: sector_config
            });
            return;
        }

        const active_index: number = TickingSector.getChunkActiveIndex(chunk);
        if (active_index >= 0) return;

        for (let this_sector of active_sectors) {
            for (let adj_index = 0; adj_index < 4; adj_index++) {
                const adj_sector: SectorInfo = TickingSector.getAdjacent(this_sector, adj_index);
                const in_adjacent: boolean = TickingSector.containsChunk(adj_sector, chunk);

                if (in_adjacent) {
                    TickingSector.activateSector(adj_sector);
                    return;
                }
            }
        }
    }

    public static ensureActiveAround(x: number, z: number, config?: LengthConfig): void {
        const this_chunk: ChunkID = MinecraftChunk.getChunkID(x, z);
        TickingSector.ensureActiveChunk(this_chunk, config);
    };

    /**
     * Evaluates how well a configuration fits a specific chunk length.
     * Lower 'remaining' means less wasted space or fewer partial sectors.
     */
    private static _evaluateConfig(config: LengthConfig, length: number, z_dom?: boolean): ConfigEvaluation {
        const config_length = z_dom ? config.lZ : config.lX;
        const remaining: number = length % config_length;
        return { config, remaining };
    }

    /**
     * Comparison logic to keep the configuration with the smallest remainder.
     */
    private static _lessRemaining(eval0: ConfigEvaluation, eval1?: ConfigEvaluation): ConfigEvaluation {
        if (eval1 && eval1.remaining < eval0.remaining) return eval1;
        return eval0;
    }

    /**
     * Determines the optimal LengthConfig for a Zone based on its X/Z dimensions.
     * Minimizes "overshoot" where a ticking area covers significantly more than the zone.
     */
    public static ZoneXZconfig(length_x: number, length_z: number): LengthConfig {
        const z_dom: boolean = (length_z > length_x);
        const offset_length: number = z_dom ? length_z + 15 : length_x + 15;


        // Convert block length to total chunk length (rounding up)
        const chunk_length: number = (offset_length | 0) >> 4;

        const configs = TickingSector.CONFIGURATION;
        const configs_length = TickingSector.CONFIG_SIZE;

        let best_evaluation: ConfigEvaluation = TickingSector._evaluateConfig(configs[0], chunk_length, z_dom);

        for (let config_idx = 1; config_idx < configs_length; config_idx++) {
            const evaluation = TickingSector._evaluateConfig(configs[config_idx], chunk_length, z_dom);
            best_evaluation = TickingSector._lessRemaining(best_evaluation, evaluation);
        }

        // Default fallback to 10x10 if something goes wrong
        return best_evaluation ? best_evaluation.config : TickingSector.CONFIGURATION[SECTORCONFIG.config_2];
    }


    public readonly ID: string;
    public readonly origin: Chunk;
    public readonly config: LengthConfig;
    private _index: number = -1;

    constructor(sector: SectorInfo) {
        this.ID = TickingSector._newSectorID();
        this.origin = new MinecraftChunk(sector.origin);
        this.config = TickingSector.toSectorConfig(sector.config);
    };

    public get terminal(): Chunk { return TickingSector.getTerminal(this); };
    public get index(): number { return this._index; };
    public set index(num: number) {
        const active_idx = TickingSector.getActiveIndex(this);
        if (num < 0 && active_idx >= 0) TickingSector.removeSector(this);
        else if (num >= 0 && active_idx === -1) TickingSector.activateSector(this);
    };
    public get is_active(): boolean { return this.index >= 0; };
    public set is_active(bool: boolean) { this.index = bool ? 0 : -1; };
    public contains(chunk: ChunkID): boolean { return TickingSector.containsChunk(this, chunk); }
}
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

        const SECTOR_LENGTHS: LengthConfig = TickingSector.ZoneXZconfig(zone.X.length, zone.Z.length);

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
        const EnsureSectorActive= (x: number, z: number) => {
            TickingSector.ensureActiveAround(x, z, SECTOR_LENGTHS);
        };
        const CleanUp = () => {
            TickingSector.removeAll()
            IN_PROGRESS = false;
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
                EnsureSectorActive(ox, tx);
                EnsureSectorActive(tx, tz);
                // Y Loop (The innermost workhorse)
                for (let dy = 0; dy < y_count; dy++) {
                    if (!IN_PROGRESS) {
                        CleanUp();
                        return;
                    }
                    if (zone_index % 8 === 0) UpdateProgress(zone_index);
                    if (zone_index % 64 === 0) loops.pause(1);
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