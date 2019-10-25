const ATTACK_POWER = 2;
const CONFUSED_ATTACK_POWER = 1;
const STATUS_HIT_CHANCE = 0xBE;
const LEVEL = 100;

const FIRE_ATK_REDUC    = 80;
const NORMAL_ATK_REDUC  = 50;
const GHOST_ATK_REDUC   = 70;
const DRAGON_ATK_INC   = 130;

const WATER_SPEED_REDUC     = 60;
const ELECTRIC_SPEED_REDUC  = 60;
const FLYING_SPEED_INC      = 150;

const ROCK_DEF_INC = 150;

const WATER_SPATK_REDUC    = 80;
const DRAGON_SPATK_INC   = 130;

const STEEL_SPDEF_INC   = 150;

const BUG_HIT_NOT_MISS      = Math.floor((50) * 100 * 255 / 100);
const ELECTRIC_HIT_NOT_MISS = Math.floor((75) * 100 * 255 / 100);
const FAIRY_SAME_SEX_HIT_NOT_MISS = Math.floor((65) * 100 * 255 / 100);
const FAIRY_DIFF_SEX_HIT_NOT_MISS = Math.floor((30) * 100 * 255 / 100);
const PSYCHIC_HIT_NOT_MISS = Math.floor((85) * 100 * 255 / 100);
const GHOST_HIT_NOT_MISS   = Math.floor((70) * 100 * 255 / 100);


const BONUS_EFFECTIVE = 150;
const BONUS_INEFFECTIVE = 75;
const SINGLE_TYPE_BOOST = 120;

const decimals = 1000000;

const Moves = {
    RECHARGE      : 0,
    CLEANSE       : 1,
    PROTECT       : 2,
    SHIELD_BREAK  : 3,
    ATK1          : 4,
    SPATK1        : 5,
    STATUS1       : 6,
    ATK2          : 7,
    SPATK2        : 8,
    STATUS2       : 9,
};


const Type =  {
  Normal      : 0,
  Fighting    : 1,
  Flying      : 2,
  Poison      : 3,
  Ground      : 4,
  Rock        : 5,
  Bug         : 6,
  Ghost       : 7,
  Steel       : 8,
  Fire        : 9,
  Water       : 10,
  Grass       : 11,
  Electric    : 12,
  Psychic     : 13,
  Ice         : 14,
  Dragon      : 15,
  Dark        : 16,
  Fairy       : 17,
  Unknown     : 18
};

const Gender = {
  Male      : 0,
  Female    : 1,
  Unknown   : 2,
};

/**
 enum Gender {
        Male,
        Female,
        Unknown
    }

 struct Stats {
        uint8 hp;
        uint8 atk;
        uint8 def;
        uint8 spAtk;
        uint8 spDef;
        uint8 speed;
    }

 struct PokemonData {
        uint8 id;
        Type type1;
        Type type2;
        Stats base;
    }

 struct Pokemon {
        uint8 id;
        Gender gender;
        bool isShiny;
        Stats IVs;
        Stats stats;
    }
CryptoMonState {
    let hp;
    let status1;
    let status2;
    let charges;
    Pokedex.Pokemon cryptoMon;
    Pokedex.PokemonData data;
    let move;
  }

  struct BattleState {
    CryptoMonState player;
    CryptoMonState opponent;
    let random;
  }
**/

function check(bool, message) {
  if(!bool) {
    throw message;
  }
}

function revert(message) {
  throw message;
}

export function calculateBattle(state) {
  let playerSpeed   = calculateEffectiveSpeed(state.player, state.opponent);
  let opponentSpeed = calculateEffectiveSpeed(state.opponent, state.player);

  let switchTurn = playerSpeed < opponentSpeed;

  if(playerSpeed === opponentSpeed) {
    let [ random, nextR ] = getNextR(state.random);
    state.random = random;
    switchTurn = nextR > 0x0F;
  }

  if(switchTurn) {
    state = swap(state);
  }

  state = moveTurn(state);

  if(someoneDied(state)) return swapIfSwitched(state, switchTurn);

  state = moveTurn(swap(state));

  if(someoneDied(state)) return swapIfSwitched(state, !switchTurn);

  state = calculateEndDamage(swap(state));

  if(someoneDied(state)) return swapIfSwitched(state, switchTurn);

  state = calculateEndDamage(swap(state));

  if(someoneDied(state)) return swapIfSwitched(state, !switchTurn);

  return swapIfSwitched(state, !switchTurn);
}

function swap(state){
  let first = state.opponent;
  state.opponent = state.player;
  state.player = first;
  return state;
}

function swapIfSwitched(state, switched){
  if(switched) {
    return swap(state);
  }

  return state;
}

function moveTurn(state){
  if(state.player.move === Moves.PROTECT) return state;

  if(needsCharge(state.player.move)) {
    check(state.player.charges > 0, "Player needs a charge to do this move");
    state.player.charges = state.player.charges - 1;
  }

  if(state.player.move === Moves.RECHARGE) {
    check(state.player.charges < 3, "Player recharge not possible when over 3");
    state.player.charges = state.player.charges + 1;
    return state;
  }

  if(usesFirstType(state.player.move)) {
    check(state.player.data.type1 !== Type.Unknown, "Player attack cant be done with Unknown type");
  }

  if(usesSecondType(state.player.move)) {
    check(state.player.data.type2 !== Type.Unknown, "Player attack cant be done with Unknown type");
  }

  if(isAttacking(state.player.move)) {
    let [ random1, criticalR ] = getNextR(state.random);
    let [ random2, jitterR ]   = getNextR(random1);
    let [ random3, hitR ]    = getNextR(random2);
    state.random = random3;
    let hit = willHit(state.player, state.opponent, hitR);
    if(hit) {
      let damage = calculateEffectiveDamage(state.player, state.opponent, criticalR, jitterR);

      if(state.player.data.type2 === Type.Unknown) {
        damage = Math.floor(damage * SINGLE_TYPE_BOOST / 100);
      }

      if(state.opponent.hp < damage) {
        state.opponent.hp = 0;
      } else {
        state.opponent.hp = state.opponent.hp - damage;
      }
    } else {
      state.player.charges = state.player.charges + 1;
      if(isConfused(state.player, state.opponent)) {
        let effectiveAtk = state.player.cryptoMon.stats.atk;
        let effectiveDef = state.player.cryptoMon.stats.def;
        let confusedDmg = Math.floor((Math.floor(Math.floor(Math.floor(2*LEVEL/5) + 2) * CONFUSED_ATTACK_POWER * effectiveAtk) / effectiveDef)/50) + 2;
        if(state.player.hp < confusedDmg) {
          state.player.hp = 0;
        } else {
          state.player.hp = state.player.hp - confusedDmg;
        }
      }
    }

    return state;
  }

  if(state.player.move === Moves.SHIELD_BREAK) {
    if(state.opponent.move === Moves.PROTECT) {
      let shieldBreakDmg = Math.floor(state.opponent.cryptoMon.stats.hp / 3);
      if(state.opponent.hp < shieldBreakDmg) {
        state.opponent.hp = 0;
      } else {
        state.opponent.hp = state.opponent.hp - shieldBreakDmg;
      }

      return state;
    } else {
      //No returning charge cause shield break should only be used on Protect spam
      return state;
    }
  }

  if(state.player.move === Moves.STATUS1) {
    let [random, statusHit] = getNextR(state.random);
    state.random = random;
    if(canStatus(state, statusHit)){
      state.opponent.status1 = true;
    } else {
      state.player.charges = state.player.charges + 1;
    }
    return state;
  }

  if(state.player.move === Moves.STATUS2) {
    let [ random, statusHit] = getNextR(state.random);
    state.random = random;
    if(canStatus(state, statusHit)){
      state.opponent.status2 = true;
    } else {
      state.player.charges = state.player.charges + 1;
    }
    return state;
  }

  if(state.player.move === Moves.CLEANSE) {
    state.player.status1 = false;
    state.player.status2 = false;
    return state;
  }

  return state;
}

function canStatus(state, random) {
  if(state.player.status1) check(state.opponent.data.type1 !== Type.Ice, "Cant use Status while Froze");
  if(state.player.status2) check(state.opponent.data.type2 !== Type.Ice, "Cant use Status while Froze");
  return random < STATUS_HIT_CHANCE;
}

function calculateEffectiveDamage(state, otherState, criticalR, jitterR) {

  if(otherState.move === Moves.PROTECT) return 0;

  let damage = 0;

  if(state.move === Moves.ATK1 || state.move === Moves.ATK2) {
    let effectiveAtk = calculateEffectiveAtk(state, otherState);
    let effectiveDef = calculateEffectiveDef(otherState, state);

    damage = Math.floor((Math.floor(Math.floor(Math.floor(2*LEVEL/5) + 2) * ATTACK_POWER * effectiveAtk) / effectiveDef)/50) + 2;
  } else if(state.move === Moves.SPATK1 || state.move === Moves.SPATK2) {
    let effectiveSpAtk = calculateEffectiveSpAtk(state, otherState);
    let effectiveSpDef = calculateEffectiveSpDef(otherState, state);

    damage = Math.floor((Math.floor(Math.floor(Math.floor(2*LEVEL/5) + 2) * ATTACK_POWER * effectiveSpAtk) / effectiveSpDef)/50) + 2;
  } else {
    revert("Attacking move should be an attacking move");
  }

  let isCritical = criticalR < getCriticalHitThreshold(state, otherState);
  if(isCritical) damage = Math.floor(damage * 150 / 100);

  let jitter = ( Math.floor(jitterR * decimals / 255) * (255-217)  ) + (217 * decimals);
  damage = Math.floor(Math.floor(damage * jitter / 255) / decimals);

  let attackingType = 0;
  if(usesFirstType(state.move)) {
    attackingType = state.data.type1;
  } else {
    attackingType = state.data.type2;
  }
  let multiplierId = getMultiplierID(attackingType, otherState.data.type1, otherState.data.type2);
  if(multiplierId === 3) {
    return damage;
  }

  if(multiplierId > 4) {
    damage = Math.floor(damage * BONUS_EFFECTIVE / 100);
    if(multiplierId === 5) {
      damage = Math.floor(damage * BONUS_EFFECTIVE / 100);
    }
    return damage;
  }

  if(multiplierId < 3) {
    damage = Math.floor(damage * BONUS_INEFFECTIVE / 100);
    if(multiplierId < 2) {
      damage = Math.floor(damage * BONUS_INEFFECTIVE / 100);
      if(multiplierId === 0) {
        damage = Math.floor(damage * BONUS_INEFFECTIVE / 100);
      }
    }

  }

  return damage;
}

//SPEED ----------------------------------------
function calculateEffectiveSpeed(state, otherState) {
  let speed = state.cryptoMon.stats.speed;
  if(state.status1) speed = getSpeedModified(speed, otherState.data.type1);
  if(state.status2) speed = getSpeedModified(speed, otherState.data.type2);
  if(otherState.status2) speed = getSpeedModifiedByOpponent(speed, state.data.type2);
  if(otherState.status2) speed = getSpeedModifiedByOpponent(speed, state.data.type2);
  return speed;
}

function getSpeedModified(baseSpeed, status) {
  if(status === Type.Water) return Math.floor(baseSpeed * WATER_SPEED_REDUC /100);
  if(status === Type.Electric) return Math.floor(baseSpeed * ELECTRIC_SPEED_REDUC /100);
  if(status === Type.Ice) return 0;
  return baseSpeed;
}

function getSpeedModifiedByOpponent(baseSpeed, status) {
  if(status === Type.Flying) return Math.floor(baseSpeed * FLYING_SPEED_INC /100);
  return baseSpeed;
}
// -----------------------------------------------


//ATTACK ----------------------------------------
function calculateEffectiveAtk(state, otherState) {
  let atk = state.cryptoMon.stats.atk;
  if(state.status1) atk = getAtkModified(atk, otherState.data.type1);
  if(state.status2) atk = getAtkModified(atk, otherState.data.type2);
  if(otherState.status2) atk = getAtkModifiedByOpponent(atk, state.data.type2);
  if(otherState.status2) atk = getAtkModifiedByOpponent(atk, state.data.type2);
  return atk;
}

function getAtkModified(baseAtk, status) {
  if(status === Type.Fire) return Math.floor(baseAtk * FIRE_ATK_REDUC / 100);
  if(status === Type.Normal) return Math.floor(baseAtk * NORMAL_ATK_REDUC / 100);
  if(status === Type.Ghost) return Math.floor(baseAtk * GHOST_ATK_REDUC / 100);
  return baseAtk;
}

function getAtkModifiedByOpponent(baseAtk, status) {
  if(status === Type.Dragon) return Math.floor(baseAtk * DRAGON_ATK_INC /100);
  return baseAtk;
}
// -----------------------------------------------

//DEFENSE ----------------------------------------
function calculateEffectiveDef(state, otherState) {
  let def = state.cryptoMon.stats.def;
  if(state.status1) def = getDefModified(def, otherState.data.type1);
  if(state.status2) def = getDefModified(def, otherState.data.type2);
  if(otherState.status2) def = getDefModifiedByOpponent(def, state.data.type2);
  if(otherState.status2) def = getDefModifiedByOpponent(def, state.data.type2);
  return def;
}

function getDefModified(baseDef, /*status*/) {
  return baseDef;
}

function getDefModifiedByOpponent(baseDef, status) {
  if(status === Type.Rock) return Math.floor(baseDef * ROCK_DEF_INC /100);
  return baseDef;
}
// -----------------------------------------------


//SPATTACK ----------------------------------------
function calculateEffectiveSpAtk(state, otherState) {
  let spAtk = state.cryptoMon.stats.spAtk;
  if(state.status1) spAtk = getSpAtkModified(spAtk, otherState.data.type1);
  if(state.status2) spAtk = getSpAtkModified(spAtk, otherState.data.type2);
  if(otherState.status2) spAtk = getSpAtkModifiedByOpponent(spAtk, state.data.type2);
  if(otherState.status2) spAtk = getSpAtkModifiedByOpponent(spAtk, state.data.type2);
  return spAtk;
}

function getSpAtkModified(baseSpAtk, status) {
  if(status === Type.Water) return Math.floor(baseSpAtk * WATER_SPATK_REDUC / 100);
  return baseSpAtk;
}

function getSpAtkModifiedByOpponent(baseSpAtk, status) {
  if(status === Type.Dragon) return Math.floor(baseSpAtk * DRAGON_SPATK_INC /100);
  return baseSpAtk;
}
// -----------------------------------------------

//SPDEFENSE ----------------------------------------
function calculateEffectiveSpDef(state, otherState) {
  let spDef = state.cryptoMon.stats.spDef;
  if(state.status1) spDef = getSpDefModified(spDef, otherState.data.type1);
  if(state.status2) spDef = getSpDefModified(spDef, otherState.data.type2);
  if(otherState.status2) spDef = getSpDefModifiedByOpponent(spDef, state.data.type2);
  if(otherState.status2) spDef = getSpDefModifiedByOpponent(spDef, state.data.type2);
  return spDef;
}

function getSpDefModified(baseSpDef, /*status*/) {
  return baseSpDef;
}

function getSpDefModifiedByOpponent(baseSpDef, status) {
  if(status === Type.Steel) return Math.floor(baseSpDef * STEEL_SPDEF_INC /100);
  return baseSpDef;
}
// -----------------------------------------------

// CRITICAL ---------------------------------------------
function getCriticalHitThreshold(state, otherState) {
  let T = state.data.base.speed;
  if((otherState.status1 && state.data.type1 === Type.Fighting) || (otherState.status2 && state.data.type2 === Type.Fighting) ) {
    T =T * 8;
  } else {
    T = Math.floor(T / 2);
  }
  if(T > 0xFF) {
    return 0xFF;
  }
  return T;
}
// ------------------------------------------------------------

//MISS HIT -------------------------------------------
function willHit(state, otherState, random) {
  if(state.status1 && state.status2) {
    let odds1 = getMissOdds(otherState.data.type1, state.cryptoMon.gender === otherState.cryptoMon.gender);
    let odds2 = getMissOdds(otherState.data.type2, state.cryptoMon.gender === otherState.cryptoMon.gender);
    let odds = Math.floor(
      Math.floor((odds1) * decimals / 255) *  Math.floor((odds2) * decimals / 255) * 255 / (decimals * decimals)
    );
    return random > odds;
  } else if(state.status1) {
    return random > getMissOdds(otherState.data.type1, state.cryptoMon.gender === otherState.cryptoMon.gender);
  } else if(state.status2) {
    return random > getMissOdds(otherState.data.type2, state.cryptoMon.gender === otherState.cryptoMon.gender);
  } else {
    return true;
  }
}

function getMissOdds(ptype, sameSex) {
  if(ptype === Type.Bug) return BUG_HIT_NOT_MISS;
  if(ptype === Type.Electric) return ELECTRIC_HIT_NOT_MISS;
  if(ptype === Type.Ghost) return GHOST_HIT_NOT_MISS;
  if(ptype === Type.Psychic) return PSYCHIC_HIT_NOT_MISS;
  if(ptype === Type.Fairy) {
    if(sameSex) return FAIRY_SAME_SEX_HIT_NOT_MISS;
    return FAIRY_DIFF_SEX_HIT_NOT_MISS;
  }

  return 0;
}


function isConfused(state, otherState) {
  if(state.status1 && otherState.data.type1 === Type.Psychic) return true;
  if(state.status2 && otherState.data.type2 === Type.Psychic) return true;
  return false;
}
// --------------------------------------------------


function calculateEndDamage(state){
  let healing = 0;
  if(state.opponent.status1) healing = healing + calculateEndHealingForType(state, state.player.data.type1);
  if(state.opponent.status2) healing = healing + calculateEndHealingForType(state, state.player.data.type2);

  if(state.player.hp + healing < state.player.cryptoMon.stats.hp) {
    state.player.hp = state.player.hp + healing;
  } else {
    state.player.hp = state.player.cryptoMon.stats.hp;
  }

  let damage = 0;
  if(state.player.status1) damage = damage + calculateEndDamageForType(state, state.opponent.data.type1);
  if(state.player.status2) damage = damage + calculateEndDamageForType(state, state.opponent.data.type2);

  if(state.player.hp < damage) {
    state.player.hp = 0;
  } else {
    state.player.hp = state.player.hp - damage;
  }

  return state;
}

function calculateEndDamageForType(state, ptype) {
  if(ptype === Type.Grass) return Math.floor(Math.floor(state.player.cryptoMon.stats.hp * decimals / 16) / decimals);
  if(ptype === Type.Poison) return Math.floor(Math.floor(state.player.cryptoMon.stats.hp * decimals / 10) / decimals);
  if(ptype === Type.Fire) return Math.floor(Math.floor(state.player.cryptoMon.stats.hp * decimals / 16) / decimals);
  if(ptype === Type.Flying) return Math.floor(Math.floor(state.player.cryptoMon.stats.hp * decimals / 16) / decimals);
  if(ptype === Type.Rock) return Math.floor(Math.floor(state.player.cryptoMon.stats.hp * decimals / 16) / decimals);
  if(ptype === Type.Ground && (isAttacking(state.player.move) || isStatus(state.player.move))) {
    return Math.floor(Math.floor(state.player.cryptoMon.stats.hp * decimals / 16) / decimals);
  }

  return 0;
}

function calculateEndHealingForType(state, ptype) {
  if(ptype === Type.Grass) return Math.floor(Math.floor(state.opponent.cryptoMon.stats.hp * decimals / 16) / decimals);
  return 0;
}

//RANDOM ---------------------------------------
function getNextR(random) {
  let i = random.length - 1;
  let nextR = random[i];
  return [random.slice(0, i), nextR];
}

// -----------------------------------------------------


export function needsCharge(move) {
  return move !== Moves.RECHARGE && move !== Moves.PROTECT;
}

function isAttacking(move) {
  return move === Moves.ATK1 || move === Moves.ATK2 || move === Moves.SPATK1 || move === Moves.SPATK2;
}

function isStatus(move) {
  return move === Moves.STATUS1 || move === Moves.STATUS2;
}

export function someoneDied(state) {
  return state.player.hp === 0 || state.opponent.hp === 0;
}

export function usesFirstType(move) {
  return move === Moves.ATK1 || move === Moves.SPATK1 || move === Moves.STATUS1;
}

export function usesSecondType(move) {
  return move === Moves.ATK2 || move === Moves.SPATK2 || move === Moves.STATUS2;
}


function getMultiplierID(attackingType, defendingType1, defendingType2) {
  //0 - 25 - 50 - 100 - 200 - 400
  //0 - 1  - 2  -  3  - 4   - 5
  let multiplierID = 3;

  if(attackingType === Type.Normal) {
    if(defendingType1 === Type.Ghost || defendingType2 === Type.Ghost) return 0;
    if(defendingType1 === Type.Rock || defendingType2 === Type.Rock) multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Steel || defendingType2 === Type.Steel) multiplierID = multiplierID - 1;
  } else if(attackingType === Type.Fighting) {
    if(defendingType1 === Type.Ghost || defendingType2 === Type.Ghost) return 0;
    if(defendingType1 === Type.Rock   || defendingType2 === Type.Rock)   multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Steel  || defendingType2 === Type.Steel)  multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Ice    || defendingType2 === Type.Ice)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Dark   || defendingType2 === Type.Dark)   multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Flying || defendingType2 === Type.Flying) multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Poison || defendingType2 === Type.Poison) multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Psychic|| defendingType2 === Type.Psychic)multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Bug    || defendingType2 === Type.Bug)    multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Fairy  || defendingType2 === Type.Fairy)  multiplierID = multiplierID - 1;
  } else if(attackingType === Type.Flying) {
    if(defendingType1 === Type.Fighting || defendingType2 === Type.Fighting) multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Bug || defendingType2 === Type.Bug) multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Grass    || defendingType2 === Type.Grass)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Rock || defendingType2 === Type.Rock) multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Steel   || defendingType2 === Type.Steel)   multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Electric  || defendingType2 === Type.Electric)  multiplierID = multiplierID - 1;
  } else if(attackingType === Type.Poison) {
    if(defendingType1 === Type.Steel  || defendingType2 === Type.Steel) return 0;
    if(defendingType1 === Type.Grass  || defendingType2 === Type.Grass)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Fairy  || defendingType2 === Type.Fairy)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Poison || defendingType2 === Type.Poison) multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Ground || defendingType2 === Type.Ground) multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Rock   || defendingType2 === Type.Rock) multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Ghost  || defendingType2 === Type.Ghost)   multiplierID = multiplierID - 1;
  } else if(attackingType === Type.Ground) {
    if(defendingType1 === Type.Poison || defendingType2 === Type.Poison) multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Rock || defendingType2 === Type.Rock) multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Steel || defendingType2 === Type.Steel) multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Fire || defendingType2 === Type.Fire) multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Electric || defendingType2 === Type.Electric) multiplierID = multiplierID + 1;

    if(defendingType1 === Type.Flying || defendingType2 === Type.Flying) return 0;
    if(defendingType1 === Type.Bug   || defendingType2 === Type.Bug) multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Grass  || defendingType2 === Type.Grass) multiplierID = multiplierID - 1;
  } else if(attackingType === Type.Rock) {
    if(defendingType1 === Type.Flying  || defendingType2 === Type.Flying)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Bug  || defendingType2 === Type.Bug)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Fire  || defendingType2 === Type.Fire)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Ice  || defendingType2 === Type.Ice)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Fighting  || defendingType2 === Type.Fighting)    multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Ground || defendingType2 === Type.Ground) multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Steel || defendingType2 === Type.Steel) multiplierID = multiplierID - 1;
  } else if(attackingType === Type.Bug) {
    if(defendingType1 === Type.Grass  || defendingType2 === Type.Grass)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Psychic  || defendingType2 === Type.Psychic)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Dark  || defendingType2 === Type.Dark)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Fighting  || defendingType2 === Type.Fighting)    multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Flying  || defendingType2 === Type.Flying)    multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Poison  || defendingType2 === Type.Poison)    multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Ghost  || defendingType2 === Type.Ghost)    multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Steel || defendingType2 === Type.Steel) multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Fire || defendingType2 === Type.Fire) multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Fairy || defendingType2 === Type.Fairy) multiplierID = multiplierID - 1;
  } else if(attackingType === Type.Ghost) {
    if(defendingType1 === Type.Ghost  || defendingType2 === Type.Ghost)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Psychic  || defendingType2 === Type.Psychic)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Normal  || defendingType2 === Type.Normal)    return 0;
    if(defendingType1 === Type.Dark  || defendingType2 === Type.Dark)    multiplierID = multiplierID - 1;
  } else if(attackingType === Type.Steel) {
    if(defendingType1 === Type.Rock  || defendingType2 === Type.Rock)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Ice  || defendingType2 === Type.Ice)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Fairy  || defendingType2 === Type.Fairy)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Steel  || defendingType2 === Type.Steel)    multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Fire  || defendingType2 === Type.Fire)    multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Water  || defendingType2 === Type.Water)    multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Electric  || defendingType2 === Type.Electric)    multiplierID = multiplierID - 1;
  } else if(attackingType === Type.Fire) {
    if(defendingType1 === Type.Bug  || defendingType2 === Type.Bug)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Steel  || defendingType2 === Type.Steel)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Grass  || defendingType2 === Type.Grass)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Ice  || defendingType2 === Type.Ice)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Rock  || defendingType2 === Type.Rock)    multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Fire  || defendingType2 === Type.Fire)    multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Water  || defendingType2 === Type.Water)    multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Dragon  || defendingType2 === Type.Dragon)    multiplierID = multiplierID - 1;
  } else if(attackingType === Type.Water) {
    if(defendingType1 === Type.Ground  || defendingType2 === Type.Ground)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Rock  || defendingType2 === Type.Rock)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Fire  || defendingType2 === Type.Fire)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Water  || defendingType2 === Type.Water)    multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Grass  || defendingType2 === Type.Grass)    multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Dragon  || defendingType2 === Type.Dragon)    multiplierID = multiplierID - 1;
  } else if(attackingType === Type.Grass) {
    if(defendingType1 === Type.Ground  || defendingType2 === Type.Ground)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Rock  || defendingType2 === Type.Rock)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Water  || defendingType2 === Type.Water)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Flying  || defendingType2 === Type.Flying)    multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Poison  || defendingType2 === Type.Poison)    multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Bug  || defendingType2 === Type.Bug)    multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Steel  || defendingType2 === Type.Steel)    multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Fire  || defendingType2 === Type.Fire)    multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Grass  || defendingType2 === Type.Grass)    multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Dragon  || defendingType2 === Type.Dragon)    multiplierID = multiplierID - 1;
  } else if(attackingType === Type.Electric) {
    if(defendingType1 === Type.Water  || defendingType2 === Type.Water)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Flying  || defendingType2 === Type.Flying)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Ground  || defendingType2 === Type.Ground)   return 0;
    if(defendingType1 === Type.Grass  || defendingType2 === Type.Grass)    multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Electric  || defendingType2 === Type.Electric)    multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Dragon  || defendingType2 === Type.Dragon)    multiplierID = multiplierID - 1;
  } else if(attackingType === Type.Psychic) {
    if(defendingType1 === Type.Fighting  || defendingType2 === Type.Fighting)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Poison  || defendingType2 === Type.Poison)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Steel  || defendingType2 === Type.Steel)    multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Psychic  || defendingType2 === Type.Psychic)    multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Dark  || defendingType2 === Type.Dark)    return 0;
  } else if(attackingType === Type.Ice) {
    if(defendingType1 === Type.Flying  || defendingType2 === Type.Flying)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Ground  || defendingType2 === Type.Ground)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Grass  || defendingType2 === Type.Grass)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Dragon  || defendingType2 === Type.Dragon)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Steel  || defendingType2 === Type.Steel)    multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Fire  || defendingType2 === Type.Fire)    multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Water  || defendingType2 === Type.Water)    multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Ice  || defendingType2 === Type.Ice)    multiplierID = multiplierID - 1;
  } else if(attackingType === Type.Dragon) {
    if(defendingType1 === Type.Dragon  || defendingType2 === Type.Dragon)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Steel  || defendingType2 === Type.Steel)    multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Fairy  || defendingType2 === Type.Fairy)    return 0;
  } else if(attackingType === Type.Dark) {
    if(defendingType1 === Type.Ghost  || defendingType2 === Type.Ghost)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Psychic  || defendingType2 === Type.Psychic)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Fighting  || defendingType2 === Type.Fighting)    multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Dark  || defendingType2 === Type.Dark)    multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Fairy  || defendingType2 === Type.Fairy)    multiplierID = multiplierID - 1;
  } else if(attackingType === Type.Fairy) {
    if(defendingType1 === Type.Fighting  || defendingType2 === Type.Fighting)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Dragon  || defendingType2 === Type.Dragon)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Dark  || defendingType2 === Type.Dark)    multiplierID = multiplierID + 1;
    if(defendingType1 === Type.Poison  || defendingType2 === Type.Poison)    multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Steel  || defendingType2 === Type.Steel)    multiplierID = multiplierID - 1;
    if(defendingType1 === Type.Fire  || defendingType2 === Type.Fire)    multiplierID = multiplierID - 1;
  } else {
    revert("Unknown type");
  }

  return multiplierID;
}
