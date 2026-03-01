using UnityEngine;

public class TerrainGenerator : ScriptableObject {
    public TerrainData terrainData;

    public void GenerateTerrain() {
        // Generate terrain data
        terrainData = new TerrainData();

        // Send terrain generated event
        TerrainGeneratedEvent.Invoke(terrainData);
    }
}