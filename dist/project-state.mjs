export const nationalProjects=(state,countryId=state.playerId??'lumen')=>(state.projects??[]).filter(project=>(!project.type||project.type==='facility')&&(!project.countryId||project.countryId===countryId));
export const siteProjects=(state,countryId=state.playerId??'lumen')=>(state.projects??[]).filter(project=>project.type==='site'&&project.countryId===countryId);
