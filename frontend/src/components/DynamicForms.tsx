"use client";

import React, {
  useState,
  ChangeEvent,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { InputSchema } from "../../types";
import { Prediction, usePredictionContext } from "@/context/prediction";
import FileUpload from "./FilesUpload";
import { FileWithPath } from "react-dropzone";
import SliderWithInput from "./SliderWithInput";
import { MainSchema } from "../../types";
import { Type, Hash, AlignJustify } from "lucide-react";

type FormData = {
  [key: string]: string | number | boolean;
};

type DynamicFormProps = {
  schema: MainSchema;
  version: string;
  image: string;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const DynamicForms: React.FC<DynamicFormProps> = ({
  schema,
  version,
  image,
}) => {
  const [isButtonEnabled, setIsButtonEnabled] = useState(false);

  const userDataString = localStorage.getItem("userData");
  const userData = userDataString ? JSON.parse(userDataString) : null;
  const walletAddress = userData?.walletAddress;

  useEffect(() => {
    if (walletAddress) {
      setIsButtonEnabled(true);
    } else {
      setIsButtonEnabled(false);
    }
  }, []);

  const initialFormData = Object.fromEntries(
    Object.entries(schema?.Input?.properties ?? {}).map(([key, field]) => [
      key,
      field.default !== undefined ? field.default : "",
    ])
  );

  const [formData, setFormData] = useState<FormData>(initialFormData);

  console.log("SCHEMA", schema.Input);
  console.log("FORM DATA", formData);

  // const [predictions, setPrediction] = useState(null);
  const [error, setError] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState<{ [key: string]: string }>(
    {}
  );
  const [resetKey, setResetKey] = useState(0);
  const [previewUrls, setPreviewUrls] = useState<{
    [key: string]: string | null;
  }>({});
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { setPrediction, prediction, setShowInitialImage } =
    usePredictionContext();

  const handleInputChange = (
    event: ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
    key: string
  ) => {
    let value: string | number = event.target.value;

    // value = parseInt(value, 10);
    setFormData({ ...formData, [key]: value });
  };

  const handleBooleanInputChange = (
    event: ChangeEvent<HTMLInputElement>,
    key: string
  ) => {
    // const value = event.target.value === "true";
    const value = event.target.checked;
    setFormData({ ...formData, [key]: value });
  };

  const handleDrop = useCallback(
    (acceptedFiles: FileWithPath[], inputKey: string) => {
      acceptedFiles.forEach((file) => {
        const reader = new FileReader();

        reader.onloadend = () => {
          const base64String = reader.result as string;
          setPreviewUrls((prevPreviewUrls) => ({
            ...prevPreviewUrls,
            [inputKey]: base64String, // Update the specific preview URL
          }));
          setFormData((prevFormData) => ({
            ...prevFormData,
            [inputKey]: base64String,
          }));

          setSelectedFiles((prevSelectedFiles) => ({
            ...prevSelectedFiles,
            [inputKey]: file.name,
          }));
        };

        reader.readAsDataURL(file);
      });
    },
    []
  );

  useEffect(() => {
    if (prediction?.status === "canceled" && pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current); // Clear interval if prediction is canceled
      pollIntervalRef.current = null; // Reset the ref after clearing  the interval
    }
  }, [prediction?.status]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setShowInitialImage(false);
    const sanitizedFormData: FormData = {};

    for (const [key, value] of Object.entries(formData)) {
      const property = schema.Input.properties[key];
      if (!property) continue; // Skip keys that aren't defined in the schema

      const isRequired = schema.Input.required?.includes(key);
      if (!isRequired && value === "") continue; // Skip empty non-required values

      // Check if default property exists and handle type based on its type
      if ("default" in property) {
        const defaultValue = property.default;
        const valueType = typeof defaultValue;

        if (valueType === "number") {
          if (value === "") {
            sanitizedFormData[key] = defaultValue as any; // Use default if the value is empty
          } else {
            const numValue = parseFloat(value as string); // Parse value as float
            if (!isNaN(numValue)) {
              // Use Math.floor only if the type is explicitly integer
              sanitizedFormData[key] =
                property.type === "integer" ? Math.floor(numValue) : numValue;
            } else {
              sanitizedFormData[key] = value; // Preserve original value if conversion fails
              console.error(`Invalid number value for ${key}: ${value}`);
            }
          }
        } else if (valueType === "string") {
          sanitizedFormData[key] = value; // Assign directly for strings
        } else {
          sanitizedFormData[key] = value; // Assign directly for other types, though typically not expected
        }
      } else {
        // Fallback to original type handling if there is no default
        if (property.type === "number") {
          if (value === "") {
            sanitizedFormData[key] = 0; // Assuming a default of 0 for empty strings if needed
          } else {
            const numValue = parseFloat(value as string); // Use parseFloat for type "number"
            if (!isNaN(numValue)) {
              sanitizedFormData[key] = numValue; // Directly assign for numbers, no need to check for integer
            } else {
              sanitizedFormData[key] = value; // Preserve original value if conversion fails
              console.error(`Invalid number value for ${key}: ${value}`);
            }
          }
        } else if (property.type === "integer") {
          if (value === "") {
            sanitizedFormData[key] = 0; // Assuming a default of 0 for empty strings if needed
          } else {
            const intValue = parseInt(value as string, 10);
            if (!isNaN(intValue) && Number.isInteger(intValue)) {
              sanitizedFormData[key] = intValue;
            } else {
              sanitizedFormData[key] = value; // Preserve original value if conversion fails
              console.error(`Invalid integer value for ${key}: ${value}`);
            }
          }
        } else {
          sanitizedFormData[key] = value; // Directly assign for all other types
        }
      }
    }

    const requestBody = { version, input: sanitizedFormData };

    console.log("SANITIZED INPUT", sanitizedFormData);
    console.log("SCHEMA", schema.Input);

    try {
      const response = await fetch("/api/output", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      let predictionData = await response.json();

      if (response.status !== 200) {
        setError(predictionData.detail);
        return;
      }
      if (predictionData.status === 422) {
        console.error("Prediction error:", predictionData.detail);
        alert(`Prediction Error: ${predictionData.detail}`);
        return;
      }

      if (predictionData.status === 402) {
        alert(predictionData.detail);
        return;
      }
      // Set the new prediction. This will trigger the useEffect hook that handles polling.
      setPrediction(predictionData);

      // If there's an existing polling interval from a previous prediction, clear it before starting a new one
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null; // Reset the ref after clearing the interval
      }

      // start polling

      const poll = async (id: string) => {
        try {
          const pollResponse = await fetch(
            `/api/output?id=${id}&walletAddress=${walletAddress}`
          );
          const updatedPrediction = await pollResponse.json();
          setPrediction(updatedPrediction);

          if (
            ["succeeded", "failed", "canceled"].includes(
              updatedPrediction.status
            )
          ) {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
            }
          }
        } catch (pollError) {
          console.error("Polling error:", pollError);
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
        }
      };

      pollIntervalRef.current = setInterval(
        () => poll(predictionData.id),
        3000
      ); // Store interval ID in ref
    } catch (error) {
      console.error(error);
    }
  };

  const handleReset = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault(); // Prevent form submission
    setFormData(initialFormData);
    // Reset other states if needed
    setError(null);
    setSelectedFiles({});
    setPreviewUrls({});
    setResetKey((prevKey) => prevKey + 1); // This forces a re-render if needed
  };

  // Helper function to determine the type of a field
  const getFieldType = (key: string, schema: MainSchema) => {
    // First, check if the field has a type directly within the Input properties
    const directType = schema.Input?.properties[key]?.type;
    if (directType) {
      return directType;
    }

    // If not found, check if the field is referenced elsewhere in the schema
    const refKey = schema.Input?.properties[key]?.allOf?.[0]?.$ref
      ?.split("/")
      .pop();
    if (refKey && schema[refKey]) {
      return schema[refKey].type;
    }

    // If no type is found, return undefined or a default value

    return undefined;
  };

  // Helper function to check if a key corresponds to an enumeration in the main schema
  const isEnumeration = (key: string, schema: MainSchema) => {
    return schema[key]?.enum !== undefined;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 relative">
      {Object.entries(schema.Input?.properties ?? {})
        .sort(([, a], [, b]) => (a["x-order"] || 0) - (b["x-order"] || 0))
        .map(([key, field]) => {
          const isRequired = schema.Input?.required?.includes(key);
          const isJsonField = field.title && field.title.includes("Json");
          const isLongString =
            typeof field.default === "string" && field.default.length > 20;
          return (
            <div key={key} className="flex flex-col">
              <div className="flex justify-between">
                <div className="flex items-center gap-x-2 mb-1">
                  <label
                    htmlFor={key}
                    className="text-sm font-medium text-gray-700 flex items-center gap-2"
                  >
                    <span>
                      <span>
                        {isEnumeration(key, schema) ? (
                          <AlignJustify size={12} /> // Render the Justify icon if the field is an enumeration
                        ) : getFieldType(key, schema) === "integer" ||
                          getFieldType(key, schema) === "number" ? (
                          <Hash size={12} />
                        ) : getFieldType(key, schema) === "string" ? (
                          <Type size={12} />
                        ) : null}
                      </span>
                    </span>
                    <span>{key}</span>

                    {isRequired && <span className="text-red-500">*</span>}
                  </label>
                  <div>
                    <div className="text-sm text-opacity-50 opacity-50">
                      {field.type}
                    </div>
                  </div>
                </div>

                {field.minimum !== undefined && field.maximum !== undefined ? (
                  <div className="opacity-50 text-sm">
                    (minimum: {field.minimum}, maximum: {field.maximum})
                  </div>
                ) : null}
              </div>
              {field.allOf && field.allOf[0].$ref ? (
                <select
                  id={key}
                  name={key}
                  value={
                    formData[key] !== undefined ? formData[key].toString() : ""
                  }
                  onChange={(event) => handleInputChange(event, key)}
                  className="mt-1 px-2 py-2 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 outline-none"
                >
                  {(() => {
                    const refKey = field.allOf[0].$ref.split("/").pop();
                    // Check if refKey is not undefined and if the schema and the referenced schema exist and have an enum property
                    if (
                      refKey &&
                      schema &&
                      schema[refKey] &&
                      schema[refKey].enum
                    ) {
                      return schema[refKey].enum.map((value: any) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ));
                    } else {
                      return <option value="">No options available</option>;
                    }
                  })()}
                </select>
              ) : field.type === "boolean" ? (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    required={isRequired}
                    id={key}
                    name={key}
                    checked={formData[key] as boolean} // Cast to boolean since formData[key] is boolean
                    onChange={(event) => handleBooleanInputChange(event, key)}
                  // className="mt-1 px-2 py-2 block w-full border border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 outline-none"
                  />
                  <div>{field.description}</div>
                </div>
              ) : field.minimum !== undefined || field.maximum !== undefined ? (
                <SliderWithInput
                  min={field.minimum || 0}
                  max={field.maximum || 100}
                  inputKey={key}
                  // isRequired={isRequired}
                  onValueChange={(inputKey, value) => {
                    setFormData((prevFormData) => {
                      const newFormData = { ...prevFormData };
                      // Assuming `inputKey` is the key you're updating and `value` is the new value
                      newFormData[inputKey] = value !== null ? value : ""; // Set to an empty string if value is null
                      return newFormData;
                    });
                  }}
                  defaultValue={
                    typeof field.default === "number" ? field.default : 0
                  }
                />
              ) : isJsonField || isLongString ? (
                <textarea
                  id={key}
                  name={key}
                  value={(formData[key] as string) || ""}
                  required={isRequired}
                  onChange={(event) => handleInputChange(event, key)}
                  className="mt-1 px-2 py-2 block w-full border-black border  shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 outline-none resize-none"
                />
              ) : field.format === "uri" ? (
                <>
                  {selectedFiles[key] && (
                    <div className="text-[.75rem] opacity-40">
                      {selectedFiles[key]}
                    </div>
                  )}

                  <FileUpload
                    onDrop={(acceptedFiles) => handleDrop(acceptedFiles, key)}
                    previewUrl={previewUrls[key] || null}
                  />
                </>
              ) : field.type === "integer" ? (
                <input
                  type="number"
                  id={key}
                  name={key}
                  value={(formData[key] as string) || ""}
                  onChange={(event) => handleInputChange(event, key)}
                  required={isRequired}
                  className="mt-1 px-2 py-2 block w-full border border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 outline-none"
                  min={field.minimum || undefined}
                  max={field.maximum || undefined}
                  step="1"
                />
              ) : (
                <input
                  type={field.type || "number"}
                  id={key}
                  name={key}
                  value={(formData[key] as string) || ""}
                  required={isRequired}
                  onChange={(event) => handleInputChange(event, key)}
                  className="mt-1 px-2 py-2 block w-full border border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 outline-none"
                />
              )}
              <div className="mt-1 opacity-60 text-[0.75rem]">
                <div>{field.description}</div>
                {field.default !== undefined ? (
                  <div>Default: {field.default?.toString()}</div>
                ) : null}
              </div>
            </div>
          );
        })}

      <div className="sticky bottom-0">
        <div className="flex gap-4 justify-end">
          <div
            className="font-bold py-2 px-4 rounded border border-black dark:border-white cursor-pointer"
            onClick={(event) => handleReset(event)}
          >
            Reset
          </div>
          <div
            className={`bg-black text-white font-bold py-2 px-4 rounded hover:bg-opacity-70 ${isButtonEnabled ? "" : "bg-opacity-70 cursor-not-allowed"
              }`}
          >
            <button type="submit" disabled={!isButtonEnabled}>
              Boot + Runs
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};

export default DynamicForms;
