export interface IPokemon {
    id: number;
    name: string;
    species: string;
    type1: string;
    type2?: string;
    hp: number;
    attack: number;
    defense: number;
    specialAttack: number;
    specialDefense: number;
    speed: number;
    moves: IMove[];
    abilities: string[];
    // Add other relevant Pokémon stats/attributes
}

export interface IMove {
    id: number;
    name: string;
    type: string;
    power: number;
    accuracy: number;
    pp: number;
    category: 'Physical' | 'Special' | 'Status';
    description: string;
    // Add other relevant move attributes
}

export interface ITypeChart {
    attackingType: string;
    defendingType: string;
    effectiveness: number; // 0, 0.25, 0.5, 1, 2, 4
}

export interface IPokemonRepository {
    getPokemonById(id: number): Promise<IPokemon | null>;
    getAllPokemon(): Promise<IPokemon[]>;
    savePokemon(pokemon: IPokemon): Promise<void>;
    // Add methods for TypeChart and Move management if needed
}
