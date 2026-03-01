-- Pokémon Table
CREATE TABLE pokemon (
    id INT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    species VARCHAR(255) NOT NULL,
    type1_id INT NOT NULL,
    type2_id INT,
    hp INT NOT NULL,
    attack INT NOT NULL,
    defense INT NOT NULL,
    special_attack INT NOT NULL,
    special_defense INT NOT NULL,
    speed INT NOT NULL,
    sprite_url VARCHAR(255),
    FOREIGN KEY (type1_id) REFERENCES types(id),
    FOREIGN KEY (type2_id) REFERENCES types(id)
);

-- Moves Table
CREATE TABLE moves (
    id INT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type_id INT NOT NULL,
    power INT,
    accuracy INT,
    pp INT NOT NULL,
    category ENUM('Physical', 'Special', 'Status') NOT NULL,
    description TEXT,
    FOREIGN KEY (type_id) REFERENCES types(id)
);

-- Junction table for Pokémon and their moves (many-to-many)
CREATE TABLE pokemon_moves (
    pokemon_id INT NOT NULL,
    move_id INT NOT NULL,
    PRIMARY KEY (pokemon_id, move_id),
    FOREIGN KEY (pokemon_id) REFERENCES pokemon(id) ON DELETE CASCADE,
    FOREIGN KEY (move_id) REFERENCES moves(id) ON DELETE CASCADE
);

-- Types Table
CREATE TABLE types (
    id INT PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL
);

-- Type Effectiveness Table
CREATE TABLE type_effectiveness (
    attacking_type_id INT NOT NULL,
    defending_type_id INT NOT NULL,
    effectiveness DECIMAL(3,2) NOT NULL, -- e.g., 0.00, 0.25, 0.50, 1.00, 2.00, 4.00
    PRIMARY KEY (attacking_type_id, defending_type_id),
    FOREIGN KEY (attacking_type_id) REFERENCES types(id) ON DELETE CASCADE,
    FOREIGN KEY (defending_type_id) REFERENCES types(id) ON DELETE CASCADE
);