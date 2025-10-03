export default ({ config }) => {
  return {
    ...config,
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL || process.env.REACT_APP_API_URL || "http://192.168.43.176:5000",
    },
  };
};
