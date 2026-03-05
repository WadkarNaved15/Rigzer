// postModal/ActivePostForm/index.tsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MediaPostForm from "./MediaPostForm";
import GamePostForm from "./GamePostForm";
import ModelPostForm from "./ModelPostForm";
import AdModelPostForm from "./AdModelPostForm";
import { PostType } from "../../../types/postTypes";


const postFormRegistry: Record<
  PostType,
  React.FC<{ onCancel: () => void }>
> = {
  model: ModelPostForm,
  media: MediaPostForm,
  game: GamePostForm,
  ad_model: AdModelPostForm, // ← NEW: direct access if needed
  devlog: () => null,
  article: () => null,
};

const ActivePostForm = ({
  postType,
  onCancel,
}: {
  postType: PostType;
  onCancel: () => void;
}) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (postType === 'devlog') navigate('/devlogCanvas');
  }, [postType, navigate]);

  useEffect(() => {
    if (postType === 'article') navigate('/publisher');
  }, [postType, navigate]);

  if (postType === 'devlog') return null;
  if (postType === 'article') return null;

  const FormComponent = postFormRegistry[postType];
  if (!FormComponent) return null;

  return <FormComponent onCancel={onCancel} />;
};

export default ActivePostForm;