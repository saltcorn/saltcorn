import { useContext } from "react";
import optionsCtx from "../components/context";

const useTranslation = () => {
  const options = useContext(optionsCtx);
  const translations = options.translations || {};
  const t = (phrase) => translations[phrase] || phrase;
  return { t };
};

export default useTranslation;