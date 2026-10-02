import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const listProjects = () =>
  axios.get(`${API}/projects`).then((r) => r.data);

export const getProject = (id) =>
  axios.get(`${API}/projects/${id}`).then((r) => r.data);

export const createProject = (project) =>
  axios.post(`${API}/projects`, project).then((r) => r.data);

export const updateProject = (id, project) =>
  axios.put(`${API}/projects/${id}`, project).then((r) => r.data);

export const deleteProject = (id) =>
  axios.delete(`${API}/projects/${id}`).then((r) => r.data);

export const searchMaterials = (payload) =>
  axios.post(`${API}/materials/search`, payload).then((r) => r.data);

export const getRabTemplates = () =>
  axios.get(`${API}/rab/templates`).then((r) => r.data);

export const calculateRab = (request) =>
  axios.post(`${API}/rab/calculate`, request).then((r) => r.data);
