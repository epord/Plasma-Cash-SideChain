import { ICMBState, ICryptoMon, IPokemonData } from "../models/BattleInterface";
import RLP = require("rlp");
import { CryptoUtils } from "./CryptoUtils";
import {CallBack} from "./TypeDef";
import async from 'async';
import BN = require("bn.js");

export const fromBytes = (bytes: string, done: CallBack<ICMBState>) => {
    const decoded: Buffer[] = RLP.decode(bytes) as Buffer[];

    const tokenPL =  new BN(decoded[0].toString('hex'), 16).toString();
    const tokenOP =  new BN(decoded[5].toString('hex'), 16).toString();

    async.auto({
        tokenPLID: (cb: CallBack<string>) => CryptoUtils.getPlasmaCoinId(tokenPL, cb),
        tokenOPID: (cb: CallBack<string>) => CryptoUtils.getPlasmaCoinId(tokenOP, cb),
        CryptoMonPLInstance: ['tokenPLID', (results: any, cb: CallBack<ICryptoMon>) => CryptoUtils.getCryptomon(results.tokenPLID, cb)],
        CryptoMonOPInstance: ['tokenOPID', (results: any, cb: CallBack<ICryptoMon>) => CryptoUtils.getCryptomon(results.tokenOPID, cb)],
        CryptoMonPlData: ['CryptoMonPLInstance', (results: any, cb: CallBack<IPokemonData>) => CryptoUtils.getPokemonData(results.CryptoMonPLInstance.id, cb)],
        CryptoMonOPData: ['CryptoMonOPInstance', (results: any, cb: CallBack<IPokemonData>) => CryptoUtils.getPokemonData(results.CryptoMonOPInstance.id, cb)],
    }, (err: any, results: any) => {
        if (err) return done(err);
        const tokenPLID: string = results.tokenPLID;
        const tokenOPID: string = results.tokenOPID;
        const CryptoMonPLInstance: ICryptoMon = results.CryptoMonPLInstance;
        const CryptoMonOPInstance: ICryptoMon = results.CryptoMonOPInstance;
        const CryptoMonPlData: IPokemonData = results.CryptoMonPlData;
        const CryptoMonOPData: IPokemonData = results.CryptoMonOPData;

        let game: ICMBState = {
            CryptoMonPL: tokenPLID,
            CryptoMonPLInstance,
            CryptoMonPlData,
            HPPL: parseInt(decoded[1].toString('hex'), 16),
            Status1PL: Boolean(parseInt(decoded[2].toString('hex'), 16)),
            Status2PL: Boolean(parseInt(decoded[3].toString('hex'), 16)),
            ChargePL: parseInt(decoded[4].toString('hex'), 16),
            CryptoMonOP: tokenOPID,
            CryptoMonOPInstance,
            CryptoMonOPData,
            HPOP: parseInt(decoded[6].toString('hex'), 16),
            Status1OP: Boolean(parseInt(decoded[7].toString('hex'), 16)),
            Status2OP: Boolean(parseInt(decoded[8].toString('hex'), 16)),
            ChargeOP: parseInt(decoded[9].toString('hex'), 16)
        }

        if (decoded.length > 10) {
            game.HashDecision = '0x' + decoded[10].toString('hex');
            if (decoded.length > 11) {
                game.DecisionPL = parseInt(decoded[11].toString('hex'), 16);
                game.SaltPL = '0x' + decoded[12].toString('hex');
                if (decoded.length > 13) {
                    game.DecisionPL = parseInt(decoded[13].toString('hex'), 16);
                    game.SaltOP = '0x' + decoded[14].toString('hex');
                    if (decoded.length > 15) {
                        game.nextHashDecision = '0x' + decoded[15].toString('hex');
                    }
                }
            }
        }

        done(null, game);
    });
};