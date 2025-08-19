import { configureStore } from "@reduxjs/toolkit";
import snippetsReducer from "./slices/snippetsSlice";
import uiReducer from "./slices/uiSlice";
import searchReducer from "./slices/searchSlice";

export const store = configureStore({
  reducer: {
    snippets: snippetsReducer,
    ui: uiReducer,
    search: searchReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ["persist/PERSIST", "persist/REHYDRATE"],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
