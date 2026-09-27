declare module "zipcodes" {
  type ZipInfo = {
    zip: string;
    latitude: number;
    longitude: number;
    city: string;
    state: string;
    country: string;
  };
  const zipcodes: {
    lookup(zip: string | number): ZipInfo | undefined;
  };
  export default zipcodes;
}
