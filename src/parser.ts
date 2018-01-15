const REGEX_ENTITY = /(?:^|\s)((?:[\w]+\([^\)]*\))|[^\s*+?#!{]+)([*+?#!]|{(\d+),(\d+)})?/g;
const REGEX_DATA_TYPE = /^(<[^>]+>)/g;
const REGEX_KEYWORD = /^([\w-]+)/g;

export enum Entity {
  Component,
  Combinator,
  Function,
  Unknown,
}

export enum Component {
  Keyword,
  DataType,
  Group,
}

export enum Combinator {
  /** Components are mandatory and should appear in that order */
  Juxtaposition,
  /** Components are mandatory but may appear in any order */
  DoubleAmpersand,
  /** At least one of the components must be present, and they may appear in any order */
  DoubleBar,
  /** Exactly one of the components must be present */
  SingleBar,
}

export enum Multiplier {
  /** 0 or more times */
  Asterisk,
  /** 1 or more times */
  PlusSign,
  /** 0 or 1 time (that is optional) */
  QuestionMark,
  /** 1 or more times, but each occurrence separated by a comma (',') */
  HashMark,
  /** Group must produce at least 1 value */
  ExclamationPoint,
  /** At least A times, at most B times */
  QurlyBracet,
}

export type MultiplierType =
  | {
      sign:
        | Multiplier.Asterisk
        | Multiplier.PlusSign
        | Multiplier.QuestionMark
        | Multiplier.HashMark
        | Multiplier.ExclamationPoint;
    }
  | {
      sign: Multiplier.QurlyBracet;
      min: number;
      max: number;
    };

export type NonGroupDataType = {
  entity: Entity.Component;
  multiplier: MultiplierType;
  component: Component.Keyword | Component.DataType;
  value: string;
};

export type GroupDataType = {
  entity: Entity.Component;
  multiplier: MultiplierType;
  component: Component.Group;
  entities: EntityType[];
};

export type ComponentType = NonGroupDataType | GroupDataType;

export type CombinatorType = {
  entity: Entity.Combinator;
  multiplier: MultiplierType;
} & {
  combinator: Combinator;
};

export type FunctionType = {
  entity: Entity.Function;
  multiplier: MultiplierType;
};

type UnknownType = {
  entity: Entity.Unknown;
  multiplier: MultiplierType;
};

export type EntityType = ComponentType | CombinatorType | FunctionType | UnknownType;

export default function parse(syntax: string): EntityType[] {
  const levels: EntityType[][] = [[]];
  const deepestLevel = () => levels[levels.length - 1];
  let previousMatchWasComponent = false;
  let entityMatch: RegExpExecArray;
  while ((entityMatch = REGEX_ENTITY.exec(syntax))) {
    const [, value, ...rawMultiplier] = entityMatch;
    if (value.indexOf('(') !== -1) {
      deepestLevel().push({ entity: Entity.Function, multiplier: multiplierData(rawMultiplier) });
      previousMatchWasComponent = false;
      continue;
    } else if (value.indexOf('&&') === 0) {
      deepestLevel().push(combinatorData(Combinator.DoubleAmpersand, multiplierData(rawMultiplier)));
      previousMatchWasComponent = false;
      continue;
    } else if (value.indexOf('||') === 0) {
      deepestLevel().push(combinatorData(Combinator.DoubleBar, multiplierData(rawMultiplier)));
      previousMatchWasComponent = false;
      continue;
    } else if (value.indexOf('|') === 0) {
      deepestLevel().push(combinatorData(Combinator.SingleBar, multiplierData(rawMultiplier)));
      previousMatchWasComponent = false;
      continue;
    } else if (value.indexOf('[') === 0) {
      levels.push([]);
      previousMatchWasComponent = false;
      continue;
    } else if (value.indexOf(']') === 0) {
      const definitions = levels.pop();
      deepestLevel().push(componentGroupData(definitions, multiplierData(rawMultiplier)));
      previousMatchWasComponent = true;
      continue;
    } else {
      if (previousMatchWasComponent === true) {
        deepestLevel().push(combinatorData(Combinator.Juxtaposition));
      }
      let componentMatch: RegExpMatchArray;
      if ((componentMatch = value.match(REGEX_DATA_TYPE))) {
        const name = componentMatch[0];
        deepestLevel().push(componentData(Component.DataType, name, multiplierData(rawMultiplier)));
        previousMatchWasComponent = true;
        continue;
      } else if ((componentMatch = value.match(REGEX_KEYWORD))) {
        const name = componentMatch[0];
        deepestLevel().push(componentData(Component.Keyword, name, multiplierData(rawMultiplier)));
        previousMatchWasComponent = true;
        continue;
      }
    }
    deepestLevel().push({ entity: Entity.Unknown, multiplier: multiplierData(rawMultiplier) });
  }
  return levels[0];
}

function combinatorData(combinator: Combinator, multiplier?: MultiplierType): CombinatorType {
  return {
    entity: Entity.Combinator,
    combinator,
    multiplier,
  };
}

function componentData(
  component: Component.Keyword | Component.DataType,
  value: string,
  multiplier: MultiplierType,
): ComponentType {
  return {
    entity: Entity.Component,
    component,
    multiplier,
    value,
  };
}

function componentGroupData(entities: EntityType[], multiplier: MultiplierType): ComponentType {
  return {
    entity: Entity.Component,
    component: Component.Group,
    multiplier,
    entities,
  };
}

function multiplierData(raw: string[]): MultiplierType {
  if (!raw[0]) {
    return;
  }
  switch (raw[0].slice(0, 1)) {
    case '*':
      return { sign: Multiplier.Asterisk };
    case '+':
      return { sign: Multiplier.PlusSign };
    case '?':
      return { sign: Multiplier.QuestionMark };
    case '#':
      return { sign: Multiplier.HashMark };
    case '!':
      return { sign: Multiplier.ExclamationPoint };
    case '{':
      return { sign: Multiplier.QurlyBracet, min: +raw[1], max: +raw[2] };
  }
}