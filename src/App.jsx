import { useState } from "react";
import "./App.css";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Replicate from "replicate";
import * as Tone from 'tone'
// import * as tf from '@tensorflow/tfjs';
// import * as tmImage from '@teachablemachine/image';


// Create a Replicate client instance
const replicate = new Replicate({
  auth: "key",
});

function App() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [apiData, setApiData] = useState("");
  const [textReady, setTextReady] = useState(false);
  const [imgData, setImgData] = useState(null);
  const [promptChoice, setPromptChoice] = useState("");
  const [selectedFile, setSelectedFile] = useState(null); // State to store the selected file
  const [mousePosition, setMousePosition] = useState({ x: null, y: null }); // State to store mouse position
  const [croppedImageData, setCroppedImageData] = useState(null); // State to store cropped image data
  const [model, setModel] = useState(null);
  const URL = "https://teachablemachine.withgoogle.com/models/RGr9mn0up/"

  const genAI = new GoogleGenerativeAI(
    "key"
  );
  const proVision = genAI.getGenerativeModel({model: "gemini-pro-vision"});
  const voices = speechSynthesis.getVoices();

  const predict = async () => {
    // Get the image from the document
    const image = new Image();
    image.src = imgData;
    image.onload = async () => {
      const prediction = await model.predict(image);
      console.log(prediction);
      // Go through the prediction list and give the name of the artist with the highest probability
      // Prediction is of the form [{className: "artist1", probability: 0.5}, {className: "artist2", probability: 0.3}, ...]
      const artist = prediction.reduce((acc, curr) => {   
        return curr.probability > acc.probability ? curr : acc;
      });
      
      console.log(artist.className);

      const painter = artist.className;
      
      // Call gemini-pro model to get suggestions of new art for the user
      const prompt = `I have just viewed a painting that is in a similar style to ${painter}. Suggest only 1 painting by ${painter} or in his style for me, starting with the words: "If you enjoyed this painting similar to [painter's] style, then you might also enjoy". Describe the suggested painting briefly.`;
      // The mime type is everything after data: up to the first semi-colon
      const mime = imgData.split(",")[0].split(":")[1].split(";")[0];
      const relevantImage = {
        inlineData: {
          data: imgData.split(",")[1],
          mimeType: mime,
        },
      };
      const result = await proVision.generateContent([prompt, relevantImage]);
      const response = await result.response;
      const text = response.text();

      console.log(text);
      
      speakText(text);
    };
  }

  const speakText = (text) => {
    // After each sentence, a pause is added by adding a space and a period to the end of the sentence
    // This is done to allow the user to process the information before the next sentence is spoken
    // Split the input string into sentences
    const sentences = text.split('. ');

    // Add an additional space and period after each sentence
    const transformedString = sentences.map(sentence => sentence.trim() + '. ! . ! ').join('');

    console.log(transformedString)
    const utterance = new SpeechSynthesisUtterance(transformedString);

    // Select a voice
    utterance.voice = voices[160]; // Choose a specific voice
    utterance.lang = "en-US";
    utterance.rate = 0.8;
    utterance.pitch = 1;

    // Speak the text
    window.speechSynthesis.speak(utterance);
  }

  const handlePlayNote = async () => {
    // Call Gemini to produce the music
    const prompt = `Based on the emotions, colors, and imagery of this painting, create a musical composition that capture the essence of the painting. Give me the notes and the duration (numeric value) of each note in the format: "F#4:1, E4:2, D4:2, C#4:2, B3:4, G#3:2" where the first part is the note and the second part is the duration. Make the notes gloomy if the image is gloomy, or happy if the image is vibrant. Only give me these note and duration combinations comma separated. Make it atleast 20 notes long.`;
    // The mime type is everything after data: up to the first semi-colon
    const mime = croppedImageData.split(",")[0].split(":")[1].split(";")[0];
    const relevantImage = {
      inlineData: {
        data: croppedImageData.split(",")[1],
        mimeType: mime,
      },
    };
    const result = await proVision.generateContent([prompt, relevantImage]);
    const response = await result.response;
    const text = response.text();
    // const text = "F#4:1, E4:2, D4:2, C#4:2, B3:4, G#3:2, F#3:2, E3:2, D3:4, C#3:2, B2:2, A#2:2, A2:1, G#2:2, F#2:2, E2:4, D2:2, C2:2, B1:4, A#1:2, A1:2";

    // Strip spaces and replace newline \n characters with spaces in the text variable
    const notes = text.replace(/\s/g, "").replace(/\n/g, " ").split(","); // Split the notes by comma

    // Turn it into a 2d list where each inner list is the duration and note
    // [["C4", "2"], ["E4", "1"], ["G4", "3"]]
    console.log(notes);

    // Make sure I dont get a null note
    if (notes[notes.length - 1] === "") {
      notes.pop();
    }

    const synth = new Tone.Synth().toDestination();

    const sequence = new Tone.Sequence((time, event) => {
      const [note, duration] = event.split(":");
      synth.triggerAttackRelease(note, duration, time); // Adjust duration if needed
    }, notes);

    sequence.start(0);
    Tone.Transport.start();

    // Stop it after 5 seconds and make sure the last note stops playing
    // Schedule a callback to stop the Transport after 5 seconds
    setTimeout(() => {
      Tone.Transport.stop();
      sequence.stop();
    }, 5000);
  }

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]); // Update selected file state
  };

  const handleMouseMove = (e) => {
    // e = Mouse click event.
    var rect = e.target.getBoundingClientRect();
    var xCoord = e.clientX - rect.left; //x position within the element.
    var yCoord = e.clientY - rect.top;  //y position within the element.
    // console.log(xCoord, yCoord, e.clientX, e.clientY)
    // console.log("Left? : " + xCoord + " ; Top? : " + yCoord + ".");
    setMousePosition({x: xCoord, y: yCoord});
    
    const canvas = document.createElement("canvas");
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;

    const image = new Image();
    image.onload = () => {
      ctx.drawImage(
        image,
        xCoord*window.devicePixelRatio - 50, // Adjust x coordinate to the top-left corner of the cropped area
        yCoord*window.devicePixelRatio - 50, // Adjust y coordinate to the top-left corner of the cropped area
        100*window.devicePixelRatio,
        100*window.devicePixelRatio,
        0,
        0,
        100,
        100
      );
      setCroppedImageData(canvas.toDataURL());
    };
    image.src = imgData;
  };

  const handleMouseOut = () => {
    setMousePosition({ x: null, y: null });
    // setCroppedImageData(null); // Reset cropped image data on mouse out
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSubmitted(true);

    // Load the image model
    const modelURL = URL + "model.json";
    const metadataURL = URL + "metadata.json";

    const model = await tmImage.load(modelURL, metadataURL);
    setModel(model);

    // Read the file
    const reader = new FileReader();
    reader.onloadend = async () => {
      const imageData = reader.result;

      // Display the image locally
      setImgData(imageData);

      // The mime type is everything after data: up to the first semi-colon
      const mime = imageData.split(",")[0].split(":")[1].split(";")[0];

      // Fetch data after file upload

      // pick a prompt based on the variable promptChoice
      const prompt = promptChoice === "choice1" ? "Generate a description based on this painting, for a visually impaired user who is partially or totally visually impaired. Allow the user to experience what the painting would feel like emotionally and physically if they stepped into it, explored it, and interacted with it." : "Provide an immersive description of this painting in the first person, as if the reader is walking through the painting and experiencing it firsthand. Describe the emotions, abstract feelings, and physical sensations that one experiences as they move through this painting.";
      // if (promptChoice === "choice1") {
      //   const prompt = "Generate a description based on this painting, for a visually impaired user who is partially or totally visually impaired. Allow the user to experience what the painting would feel like emotionally and physically if they stepped into it, explored it, and interacted with it."
      // } else {
      //   const prompt = "Provide an immersive description of this painting in the first person, as if the reader is walking through the painting and experiencing it firsthand. Describe the emotions, abstract feelings, and physical sensations that one experiences as they move through this painting."
      // }
      const image = {
        inlineData: {
          data: imageData.split(",")[1],
          mimeType: mime,
        },
      };
      console.log(prompt);
      const result = await proVision.generateContent([prompt, image]);
      const response = await result.response;
      const text = response.text();
      setApiData(text);
      setTextReady(true);
      setLoading(false);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleSpeakClick = async () => {
    // Check if it is already speaking, if so stop
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      return;
    } else {
      speakText(apiData);
    }
  }

  const handleReset = () => {
    // Reset all states to their initial values
    setLoading(false);
    setSubmitted(false);
    setApiData("");
    setTextReady(false);
    setImgData(null);
    setPromptChoice("");
    setSelectedFile(null);
  };

  // Accessability improvements:
  // Change fonts to be better
  // Increase button sizes
  // Add alt text to everything
  // Add aria labels to everything
  // Add keyboard shortcuts
  return (
    <div className="container">
      {/* Reduce the area above the title */}
      <h1 className="text-center mb-1">Art4All</h1>
      {!submitted && <div className="mt-5">
        <form onSubmit={handleSubmit}>
          <div className="row d-flex justify-content-center align-items-end">
            <div className="col-lg-6 mb-3">
              <input
                type="file"
                className="form-control form-control-lg"
                onChange={handleFileChange}
              />
            </div>
            <div className="col-lg-6 mb-3">
              <select
                className="form-control form-control-lg"
                value={promptChoice}
                onChange={(e) => setPromptChoice(e.target.value)}
              >
                <option value="">Choose a prompt</option>
                <option value="choice1">Color Knowledge</option>
                <option value="choice2">No Color Knowledge</option>
              </select>
            </div>
            <div className="col-lg-6" style={{ marginTop: "30px" }}>
              <button type="submit" className="btn btn-primary btn-lg col-lg-12" disabled={!selectedFile}>
                Submit
              </button>
            </div>
          </div>
        </form>
      </div>}
      <div className="">
        {textReady && 
          <div className="row d-flex justify-content-center align-items-end">
            {/* Button for the apiData to be spoken to the user */}
            {textReady && 
            <div className="col-lg-6">
              <div className="top-right">
                <button onClick={handleReset} className="btn btn-secondary btn-lg">Reset</button>
              </div>
              <div className="top-left">
                <button onClick={predict} className="btn btn-secondary btn-lg">Analyze Art</button>
              </div>
              <button onClick={handleSpeakClick} className="btn btn-primary btn-lg col-lg-12">
                Speak
              </button>
            </div>}
            <div>
                <img 
                  id = "uploaded-image"
                  src={imgData} 
                  alt="Uploaded Image" 
                  onMouseMove={handleMouseMove} 
                  onMouseOut={handleMouseOut}
                  onClick={handlePlayNote}
                />
              </div>
          </div>}
        {loading && <p>Loading...</p>}
      </div>
      <div className="mt-2">
        template from <a href="https://udarax.me/technology/google-gemini-pro-ai-integration-with-react/">here</a>
      </div>
    </div>
  );
}

export default App;