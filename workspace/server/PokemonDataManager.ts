import db from './db';

class PokemonDataManager {
  async getPokemonById(id: number) {
    const [rows] = await db.query('SELECT * FROM pokemon WHERE id = ?', [id]);
    return rows[0];
  }
}

export default PokemonDataManager;