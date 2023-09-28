// Importeer de benodigde modules
const axios = require("axios");
const N3 = require("n3");
const { DataFactory } = N3;
const { namedNode, literal, blankNode, quad } = DataFactory;

// Lees de shacl shape als een N3 graaf
const shape = new N3.Store();
const shapeParser = new N3.Parser({ format: "Turtle" });
shapeParser.parse(fs.readFileSync("shape.ttl", "utf8"), (error, quad, prefixes) => {
  if (quad) {
    shape.addQuad(quad);
  }
});

// Definieer de basis URI voor de gegenereerde data
const base_uri = "http://example.org/demo/";

// Definieer de frequentie waarmee de data wordt gegenereerd (in milliseconden)
const frequency = 10000;

// Definieer een functie om willekeurige waarden te genereren op basis van de shacl shape
function generateValue(node) {
  // Als de node een literal is, retourneer de waarde
  if (node.termType === "Literal") {
    return node;
  }

  // Als de node een blank node is, zoek naar de shacl constraints
  if (node.termType === "BlankNode") {
    // Zoek naar het datatype van de node
    const datatype = shape.getObjects(node, namedNode("http://www.w3.org/ns/shacl#datatype"))[0];
    if (datatype) {
      // Genereer een willekeurige waarde op basis van het datatype
      if (datatype.equals(namedNode("http://www.w3.org/2001/XMLSchema#string"))) {
        return literal(
          Array(10)
            .fill()
            .map(() => String.fromCharCode(Math.floor(Math.random() * 26) + 97))
            .join(""),
          datatype
        );
      }
      if (datatype.equals(namedNode("http://www.w3.org/2001/XMLSchema#integer"))) {
        return literal(Math.floor(Math.random() * 101), datatype);
      }
      if (datatype.equals(namedNode("http://www.w3.org/2001/XMLSchema#boolean"))) {
        return literal(Math.random() < 0.5, datatype);
      }
      if (datatype.equals(namedNode("http://www.w3.org/2001/XMLSchema#dateTime"))) {
        return literal(new Date().toISOString(), datatype);
      }
    }

    // Zoek naar de in of class constraint van de node
    const inList = shape.getObjects(node, namedNode("http://www.w3.org/ns/shacl#in"))[0];
    const class_ = shape.getObjects(node, namedNode("http://www.w3.org/ns/shacl#class"))[0];
    if (inList) {
      // Kies een willekeurige waarde uit de lijst
      return inList.value[Math.floor(Math.random() * inList.value.length)];
    }
    if (class_) {
      // Genereer een nieuwe URI voor de klasse
      return namedNode(base_uri + class_.value.split("/").pop() + "/" + Math.floor(Math.random() * 101));
    }
  }

  // Als de node geen literal of blank node is, retourneer de node zelf
  return node;
}

// Definieer een functie om synthetische data te genereren op basis van de shacl shape
function generateData() {
  // Maak een nieuwe N3 graaf voor de data
  const data = new N3.Store();

  // Zoek naar de target class van de shape
  const targetClass = shape.getObjects(null, namedNode("http://www.w3.org/ns/shacl#targetClass"))[0];

  // Genereer een willekeurig aantal instanties van de target class
  const numInstances = Math.floor(Math.random() * 10) + 1;
  for (let i = 0; i < numInstances; i++) {
    // Maak een nieuwe URI voor de instantie
    const instanceUri = namedNode(base_uri + targetClass.value.split("/").pop() + "/" + i);

    // Voeg een quad toe om aan te geven dat de instantie behoort tot de target class
    data.addQuad(quad(instanceUri, namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"), targetClass));

    // Zoek naar de property shapes van de target class
    const propertyShapes = shape.getQuads(null, namedNode("http://www.w3.org/ns/shacl#property"), null);

    // Voor elke property shape, genereer een willekeurige waarde voor de instantie
    for (const propertyShape of propertyShapes) {
      // Zoek naar het pad en het node constraint van de property shape
      const path = shape.getObjects(propertyShape.object, namedNode("http://www.w3.org/ns/shacl#path"))[0];
      const node = shape.getObjects(propertyShape.object, namedNode("http://www.w3.org/ns/shacl#node"))[0];

      // Genereer een willekeurige waarde op basis van het node constraint
      const value = generateValue(node);

      // Voeg een quad toe om de waarde toe te kennen aan de instantie via het pad
      data.addQuad(quad(instanceUri, path, value));
    }
  }

  // Retourneer de data als een turtle string
  return new N3.Writer({ format: "Turtle" }).quadsToString(data.getQuads());
}

// Definieer een functie om de data te versturen via POST naar poort 8080
function sendData(data) {
  // Stel het adres en de headers in voor het POST verzoek
  const url = "http://localhost:8080";
  const headers = { "Content-Type": "text/turtle" };

  // Verstuur het POST verzoek met de data als payload
  axios
    .post(url, data, { headers })
    .then((response) => {
      console.log("Data successfully sent");
    })
    .catch((error) => {
      console.log("Error sending data: " + error.message);
    });
}

// Definieer een hoofdfunctie om de data te genereren en te versturen in een lus
function main() {
  // Start een interval timer met de ingestelde frequentie
  setInterval(() => {
    // Genereer de data
    const data = generateData();

    // Verstuur de data
    sendData(data);
  }, frequency);
}

// Roep de hoofdfunctie aan
main();
