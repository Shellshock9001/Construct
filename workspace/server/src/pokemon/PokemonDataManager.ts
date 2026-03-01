import { IPokemon, IPokemonRepository } from './PokemonModel';

export class PokemonDataManager implements IPokemonRepository {
    // This class will handle interactions with the database
    // for storing and retrieving Pokémon data.

    async getPokemonById(id: number): Promise<IPokemon | null> {
        // TODO: Implement database query to get Pokémon by ID
        console.log(`Fetching Pokémon with ID: ${id}`);
        return null; // Placeholder
    }

    async getAllPokemon(): Promise<IPokemon[]> {
        // TODO: Implement database query to get all Pokémon
        console.log('Fetching all Pokémon');
        return []; // Placeholder
    }

    async savePokemon(pokemon: IPokemon): Promise<void> {
        // TODO: Implement database insertion/update
        console.log(`Saving Pokémon: ${pokemon.name}`);
    }
}
