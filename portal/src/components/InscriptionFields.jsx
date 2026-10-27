import { describeAge, todayIsoDate } from "../lib/age.js";
import { ID_TYPES } from "../lib/identification.js";
import { enumLabels, labels } from "../lib/labels.js";
import ChoiceGroup from "./ChoiceGroup.jsx";
import Field from "./Field.jsx";
import Notice from "./Notice.jsx";

const ID_TYPE_OPTIONS = Object.values(ID_TYPES).map((value) => ({
  value,
  label: enumLabels.idType[value],
}));
const SEX_OPTIONS = ["FEMALE", "MALE"].map((value) => ({ value, label: enumLabels.sex[value] }));

function AgePreview({ birthDate, cutoffDate }) {
  const description = describeAge(birthDate, cutoffDate);
  if (!description) return null;
  if (description.range === null) {
    return <Notice tone="warning">{labels.inscription.ageOutOfRange(description.age)}</Notice>;
  }
  return (
    <p className="field-hint">
      {labels.inscription.agePreview(description.age, enumLabels.ageRange[description.range])}
    </p>
  );
}

// Datos del niño y del adulto. Los usan el alta y la corrección de inscripciones.
export default function InscriptionFields({ values, fieldError, disabled, cutoffDate, onChange }) {
  const isIpe = values.idType === ID_TYPES.IPE;

  return (
    <>
        <fieldset className="form-section" disabled={disabled}>
          <legend>{labels.inscription.childSection}</legend>
          <ChoiceGroup
            legend={labels.inscription.idType}
            name="idType"
            options={ID_TYPE_OPTIONS}
            value={values.idType}
            onChange={(value) => onChange("idType", value)}
          />
          <Field
            label={labels.inscription.idNumber}
            hint={isIpe ? labels.inscription.idHintIpe : labels.inscription.idHintRut}
            error={fieldError("idNumber")}
          >
            {(props) => (
              <input
                {...props}
                type="text"
                inputMode={isIpe ? "numeric" : "text"}
                autoComplete="off"
                value={values.idNumber}
                onChange={(event) => onChange("idNumber", event.target.value)}
              />
            )}
          </Field>
          <ChoiceGroup
            legend={labels.inscription.sex}
            name="sex"
            options={SEX_OPTIONS}
            value={values.sex}
            onChange={(value) => onChange("sex", value)}
            error={fieldError("sex")}
          />
          <Field label={labels.inscription.birthDate} error={fieldError("birthDate")}>
            {(props) => (
              <input
                {...props}
                type="date"
                max={todayIsoDate()}
                value={values.birthDate}
                onChange={(event) => onChange("birthDate", event.target.value)}
              />
            )}
          </Field>
          <AgePreview birthDate={values.birthDate} cutoffDate={cutoffDate} />
        </fieldset>

        <fieldset className="form-section" disabled={disabled}>
          <legend>{labels.inscription.guardianSection}</legend>
          <Field label={labels.inscription.guardianName} error={fieldError("guardianName")}>
            {(props) => (
              <input
                {...props}
                type="text"
                autoComplete="off"
                value={values.guardianName}
                onChange={(event) => onChange("guardianName", event.target.value)}
              />
            )}
          </Field>
          <Field
            label={labels.inscription.guardianIdNumber}
            hint={labels.inscription.idHintRut}
            error={fieldError("guardianIdNumber")}
          >
            {(props) => (
              <input
                {...props}
                type="text"
                autoComplete="off"
                value={values.guardianIdNumber}
                onChange={(event) => onChange("guardianIdNumber", event.target.value)}
              />
            )}
          </Field>
          <Field label={labels.inscription.guardianEmail} error={fieldError("guardianEmail")}>
            {(props) => (
              <input
                {...props}
                type="email"
                autoComplete="off"
                value={values.guardianEmail}
                onChange={(event) => onChange("guardianEmail", event.target.value)}
              />
            )}
          </Field>
          <Field label={labels.inscription.guardianPhone} error={fieldError("guardianPhone")}>
            {(props) => (
              <input
                {...props}
                type="tel"
                autoComplete="off"
                value={values.guardianPhone}
                onChange={(event) => onChange("guardianPhone", event.target.value)}
              />
            )}
          </Field>
        </fieldset>
    </>
  );
}
